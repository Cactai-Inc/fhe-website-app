-- CR-126 GROUP B — Bill of Sale (HORSE_SALE_V2) field & clause overhaul.
--
-- Applied AFTER the horse DB layer (cr126_1/_2). Zero BOS documents are executed
-- (both live docs are unsigned editable drafts, 0 signatures), so re-syncing them
-- to the new defs and remerging their bodies is safe — no signed paper is touched
-- (D33). The template wording changes, so v3 is minted at the end (D34).
--
-- Every change is idempotent (guarded by the CURRENT value) so a re-run is a no-op.

-- ── B1: party-responsibility reconcile (owner_role flips) ────────────────────
-- Verified against the live defs first; the flips are exactly the ones the owner's
-- verbatim table asks for and the reconcile confirmed as genuinely wrong.
--   CO_BUYER_ENABLED + its two title fields: co-buyer info is the BUYER's.
--   PPE_CHOICE: the SELLER makes the gating pre-purchase-exam choice.
--   PPE_CONTINGENT + DRUG_TEST_ELECTION: downstream of PPE → the BUYER's.
--   BOARD_RATE_AFTER: the SELLER sets the buyer-delay fee.
UPDATE contract_field_defs SET owner_role = 'BUYER'
 WHERE template_key = 'HORSE_SALE_V2'
   AND field_key IN ('TXN.CO_BUYER_ENABLED','TXN.CO_BUYER_TITLE_FORM','TXN.CO_BUYER_TITLE_DETAIL',
                     'TXN.PPE_CONTINGENT','TXN.DRUG_TEST_ELECTION');

UPDATE contract_field_defs SET owner_role = 'SELLER'
 WHERE template_key = 'HORSE_SALE_V2'
   AND field_key IN ('TXN.PPE_CHOICE','TXN.BOARD_RATE_AFTER');

-- (FINANCING_ELECTION, SALES_TAX_RESPONSIBLE, TRIAL_*, DELIVERY_*, TRANSPORT_*,
--  TRANSFER_FEES_RESPONSIBLE, BREEDING_ELECTION are already DEAL — no change.)

-- ── B5: financing options → Included / Not Applicable ────────────────────────
UPDATE contract_field_defs
   SET options = '[{"label":"Included","value":"INCLUDED"},{"label":"Not Applicable","value":"NA"}]'::jsonb
 WHERE template_key = 'HORSE_SALE_V2' AND field_key = 'TXN.FINANCING_ELECTION';

-- Retire the "not elected" boilerplate clause: when Not Applicable, the financing
-- section content is simply omitted. Gate it to a value that can never occur so it
-- never renders (D16/D32: retire behind a flag, do not delete).
UPDATE contract_clause_defs
   SET conditional_on = '{"equals":["__RETIRED__"],"field_key":"TXN.FINANCING_ELECTION"}'::jsonb
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'PRICE.FINANCING_DECLINED';
-- (PRICE.FINANCING already gates on FINANCING_ELECTION = INCLUDED — unchanged.)

-- ── B6: PPE options → Seller Declines / Buyer Requested / Buyer Waived ───────
UPDATE contract_field_defs
   SET options = '[{"label":"Seller Declines","value":"SELLER_DECLINES"},{"label":"Buyer Requested","value":"BUYER_REQUESTED"},{"label":"Buyer Waived","value":"BUYER_WAIVED"}]'::jsonb
 WHERE template_key = 'HORSE_SALE_V2' AND field_key = 'TXN.PPE_CHOICE';

-- Re-gate the PPE clauses to the new option values:
--   CONDUCTED-equivalent → Buyer Requested
--   CONTINGENCY → Buyer Requested AND contingent = Yes
--   NA-equivalent → Seller Declines
--   Waived-equivalent → Buyer Waived
UPDATE contract_clause_defs
   SET conditional_on = '{"equals":["BUYER_REQUESTED"],"field_key":"TXN.PPE_CHOICE"}'::jsonb
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'PPE.CONDUCTED';

UPDATE contract_clause_defs
   SET conditional_on = '{"all":[{"equals":["BUYER_REQUESTED"],"field_key":"TXN.PPE_CHOICE"},{"equals":["YES"],"field_key":"TXN.PPE_CONTINGENT"}]}'::jsonb
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'PPE.CONTINGENCY';

UPDATE contract_clause_defs
   SET conditional_on = '{"equals":["SELLER_DECLINES"],"field_key":"TXN.PPE_CHOICE"}'::jsonb
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'PPE.NA';

UPDATE contract_clause_defs
   SET conditional_on = '{"equals":["BUYER_WAIVED"],"field_key":"TXN.PPE_CHOICE"}'::jsonb
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'PPE.WAIVED';

-- Downstream PPE fields gated on the old CONDUCTED value → Buyer Requested.
UPDATE contract_field_defs
   SET conditional_on = '{"equals":["BUYER_REQUESTED"],"field_key":"TXN.PPE_CHOICE"}'::jsonb
 WHERE template_key = 'HORSE_SALE_V2' AND field_key = 'TXN.PPE_CONTINGENT';

-- ── B7: PPE timing → a select with a paired date ─────────────────────────────
-- New TXN.PPE_TIMING select whose LABELS carry the composed tail phrase (with a
-- leading space). For DATE the label is " on or before" and the paired date token
-- follows it on the same line; for the other options the date is empty and renders
-- nothing. PPE_TIMING gates on Buyer Requested (only meaningful when a PPE happens).
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   format_type, options, conditional_on, required, is_optional, sort_order, closed, guidance)
SELECT 'HORSE_SALE_V2', 'TXN.PPE_TIMING', 'Examination timing', 'PPE', 'BUYER',
       'select', 'select', 'select',
       '[{"label":" on or before","value":"DATE"},{"label":" prior to delivery","value":"PRIOR_DELIVERY"},{"label":" during the evaluation period specified in this agreement","value":"EVAL_PERIOD"},{"label":"","value":"NONE"}]'::jsonb,
       '{"equals":["BUYER_REQUESTED"],"field_key":"TXN.PPE_CHOICE"}'::jsonb,
       true, false, 325, false,
       'When must the examination happen? "Date" adds "on or before {date}"; the other options add a fixed phrase or nothing.'
 WHERE NOT EXISTS (SELECT 1 FROM contract_field_defs
                    WHERE template_key='HORSE_SALE_V2' AND field_key='TXN.PPE_TIMING');

-- PPE_DEADLINE: gated on Buyer Requested (not on timing = Date) and NOT required.
-- It must stay UNGATED by PPE_TIMING so the composed sentence line never drops when
-- timing != Date (line-gating drops a whole line for any gated token whose gate is
-- unmet). The date holds a value only for the Date option (the editor prompts it
-- there via the composed phrase); for the other options its value is empty, so
-- token_display_value renders nothing and the sentence still reads correctly.
UPDATE contract_field_defs
   SET conditional_on = '{"equals":["BUYER_REQUESTED"],"field_key":"TXN.PPE_CHOICE"}'::jsonb,
       required = false,
       label = 'Examination date (used with the "Date" timing option)',
       guidance = 'Fill this in only when Examination timing is "Date".'
 WHERE template_key = 'HORSE_SALE_V2' AND field_key = 'TXN.PPE_DEADLINE';

-- Compose PPE.CONDUCTED: the tail is now "{{TXN.PPE_TIMING}} {{TXN.PPE_DEADLINE}}".
-- PPE_TIMING carries the phrase (with a leading space); PPE_DEADLINE renders the
-- date only for the Date option (empty → nothing). Both are ungated-by-timing, so
-- the line never drops and every option composes correctly. A run of spaces before
-- the period collapses in the composer's cleanup.
UPDATE contract_clause_defs
   SET body = 'Buyer may, at Buyer''s sole cost, have the Horse examined by a licensed veterinarian of Buyer''s choosing{{TXN.PPE_TIMING}} {{TXN.PPE_DEADLINE}}. Seller shall make the Horse reasonably available for the examination and shall disclose the Horse''s known medical history to the examining veterinarian on request.'
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'PPE.CONDUCTED';

-- ── B8: PPE.CONTINGENCY edits ────────────────────────────────────────────────
-- Remove "on or before {{TXN.PPE_NOTICE_DEADLINE}}"; make the deposit-refund
-- fragment deposit-driven; remove the "deemed waived" last line. Inline conditional
-- fragments cannot be expressed (the composer gates whole lines, not fragments), so
-- the clause has TWO variants gated on TXN.DEPOSIT_ENABLED — one names the deposit
-- refund, one omits it. PPE.CONTINGENCY (this row) is the WITH-deposit variant;
-- PPE.CONTINGENCY_NODEP (new, below) is the no-deposit variant.
UPDATE contract_clause_defs
   SET body = 'This sale is contingent on a pre-purchase examination whose results are satisfactory to Buyer in Buyer''s reasonable discretion. If the Buyer gives Seller written notice that the examination results are not satisfactory, this Agreement terminates, the Deposit is refunded in full, and neither party has further obligation to the other except obligations that expressly survive.',
       conditional_on = '{"all":[{"equals":["BUYER_REQUESTED"],"field_key":"TXN.PPE_CHOICE"},{"equals":["YES"],"field_key":"TXN.PPE_CONTINGENT"},{"equals":["YES"],"field_key":"TXN.DEPOSIT_ENABLED"}]}'::jsonb
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'PPE.CONTINGENCY';

-- The no-deposit variant: same clause, deposit clause fragment omitted. Gated on the
-- same PPE conditions AND DEPOSIT_ENABLED = NO. Cloned from the with-deposit row so
-- section/sort/type all match; it renders in the same slot, mutually exclusive.
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order,
   is_optional, conditional_on, render_as_subitem)
SELECT template_key, section_key, 'PPE.CONTINGENCY_NODEP', heading,
       'This sale is contingent on a pre-purchase examination whose results are satisfactory to Buyer in Buyer''s reasonable discretion. If the Buyer gives Seller written notice that the examination results are not satisfactory, this Agreement terminates, and neither party has further obligation to the other except obligations that expressly survive.',
       clause_type, sort_order, is_optional,
       '{"all":[{"equals":["BUYER_REQUESTED"],"field_key":"TXN.PPE_CHOICE"},{"equals":["YES"],"field_key":"TXN.PPE_CONTINGENT"},{"equals":["NO"],"field_key":"TXN.DEPOSIT_ENABLED"}]}'::jsonb,
       render_as_subitem
  FROM contract_clause_defs
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'PPE.CONTINGENCY'
   AND NOT EXISTS (SELECT 1 FROM contract_clause_defs
                    WHERE template_key='HORSE_SALE_V2' AND clause_key='PPE.CONTINGENCY_NODEP');
-- Retire the now-unused notice-deadline field (gate to an impossible value so it
-- never renders and is never required).
UPDATE contract_field_defs
   SET conditional_on = '{"equals":["__RETIRED__"],"field_key":"TXN.PPE_CHOICE"}'::jsonb,
       required = false
 WHERE template_key = 'HORSE_SALE_V2' AND field_key = 'TXN.PPE_NOTICE_DEADLINE';

-- ── B9: drug testing — remove the testing-window sentence ────────────────────
UPDATE contract_clause_defs
   SET body = 'At the pre-purchase examination or at delivery, whichever Buyer elects, Buyer may, at Buyer''s cost, have a licensed veterinarian draw blood or other samples from the Horse. Samples shall be split, sealed, and identified in the presence of both parties or their representatives, with one set retained by the veterinarian or a certified testing laboratory. If a certified laboratory confirms the presence of a prohibited, masking, or performance- or behavior-altering substance not disclosed in this Agreement and not administered under a disclosed current veterinary prescription, Buyer may rescind this Agreement by written notice within 5 business days of receiving the confirmed result, return the Horse in substantially the condition delivered, and receive a refund of all amounts paid including the Deposit, and Seller shall reimburse Buyer''s reasonable testing and return transport costs.'
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'PPE.DRUG_TESTING';
-- Retire TXN.DRUG_TEST_WINDOW.
UPDATE contract_field_defs
   SET conditional_on = '{"equals":["__RETIRED__"],"field_key":"TXN.DRUG_TEST_ELECTION"}'::jsonb,
       required = false
 WHERE template_key = 'HORSE_SALE_V2' AND field_key = 'TXN.DRUG_TEST_WINDOW';

-- ── B10: trial deposit disposition ───────────────────────────────────────────
-- New TXN.TRIAL_DEPOSIT_DISPOSITION select (Refunded in Full / Partial Refund (%) /
-- Not refunded); Partial reveals TXN.TRIAL_DEPOSIT_REFUND_PCT. Both gate on a
-- deposit existing AND a trial. owner_role = DEAL (either party).
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   format_type, options, conditional_on, required, is_optional, sort_order, closed, guidance)
SELECT 'HORSE_SALE_V2', 'TXN.TRIAL_DEPOSIT_DISPOSITION', 'On approved return, the Deposit is', 'TRIAL', 'DEAL',
       'select', 'select', 'select',
       '[{"label":"refunded in full","value":"FULL"},{"label":"partially refunded","value":"PARTIAL"},{"label":"not refunded","value":"NONE"}]'::jsonb,
       '{"all":[{"equals":["YES"],"field_key":"TXN.TRIAL_ENABLED"},{"equals":["YES"],"field_key":"TXN.DEPOSIT_ENABLED"}]}'::jsonb,
       true, false, 385, false, NULL
 WHERE NOT EXISTS (SELECT 1 FROM contract_field_defs
                    WHERE template_key='HORSE_SALE_V2' AND field_key='TXN.TRIAL_DEPOSIT_DISPOSITION');

INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   format_type, conditional_on, required, is_optional, sort_order, closed, guidance)
SELECT 'HORSE_SALE_V2', 'TXN.TRIAL_DEPOSIT_REFUND_PCT', 'Percentage refunded', 'TRIAL', 'DEAL',
       'number', 'number', 'percent',
       '{"all":[{"equals":["YES"],"field_key":"TXN.TRIAL_ENABLED"},{"equals":["YES"],"field_key":"TXN.DEPOSIT_ENABLED"},{"equals":["PARTIAL"],"field_key":"TXN.TRIAL_DEPOSIT_DISPOSITION"}]}'::jsonb,
       true, false, 386, false, NULL
 WHERE NOT EXISTS (SELECT 1 FROM contract_field_defs
                    WHERE template_key='HORSE_SALE_V2' AND field_key='TXN.TRIAL_DEPOSIT_REFUND_PCT');

-- TRIAL.TERMS: fix ". During" → "During". The single deposit sentence is replaced
-- by deposit-driven variants. The base paragraph ends at the return-or-execute
-- sentence; the deposit-return sentence and the "not returned" sentence follow as
-- their own lines. The deposit-return sentence has FOUR variants (no deposit / full
-- / partial / none) as sibling clauses gated on DEPOSIT_ENABLED + the new
-- disposition select — the composer gates whole lines, so a per-line variant is the
-- only correct way to compose "the Deposit of {amount} is {disposition}".
UPDATE contract_clause_defs
   SET body = 'Buyer may keep and ride the Horse on trial from {{TXN.TRIAL_START}} to {{TXN.TRIAL_END}} at {{TXN.TRIAL_LOCATION}}. During the trial period: Buyer bears all costs of the Horse''s board, care, and routine maintenance; Buyer shall use the Horse only for ordinary riding and evaluation consistent with the Horse''s training and shall not compete, breed, transport offsite (other than for veterinary care, which is always permitted), or permit third parties to ride the Horse without Seller''s written consent; and Buyer assumes all risk of injury to persons arising from the Horse during the trial period as provided in the Risk, Release, and Indemnification section of this Agreement. Seller bears the risk of loss of the Horse while Seller holds title. If the Horse dies or is injured before Closing, Buyer is entitled to the return of all amounts paid to Seller and may decline to complete the purchase by not executing the Bill of Sale, in which case Seller returns to Buyer all amounts paid and Buyer returns possession of the Horse to Seller. Nothing in this section limits Seller''s remedies for damage to the Horse caused by Buyer''s gross negligence, reckless conduct, or intentional misconduct. Unless written notice is given and approved by Seller, Buyer must return the Horse in substantially the condition received on or before {{TXN.TRIAL_END}} or execute this Agreement.'
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'TRIAL.TERMS';

-- The deposit-return sentence, then the "not returned" sentence, as render_as_subitem
-- continuation lines that fold back onto the trial paragraph (so the whole thing reads
-- as one flowing clause). The deposit-return has FOUR mutually exclusive variants
-- (no deposit / full / partial / none); the "not returned" sentence always follows.
-- Ordering: TRIAL.TERMS.sort_order (base) < return variants (base + 0.1) < not-returned
-- (base + 0.2). render_as_subitem makes each fold onto the item before it, in order.
DO $cr126_trial$
DECLARE v_sec text; v_ord numeric;
BEGIN
  SELECT section_key, sort_order INTO v_sec, v_ord
    FROM contract_clause_defs WHERE template_key='HORSE_SALE_V2' AND clause_key='TRIAL.TERMS';
  -- no deposit: no deposit sentence at all
  INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
  SELECT 'HORSE_SALE_V2', v_sec, 'TRIAL.RETURN_NODEP', NULL,
    'If Buyer returns the Horse with approved notice on or before that date, this Agreement terminates.',
    'prose', v_ord + 1, false,
    '{"all":[{"equals":["YES"],"field_key":"TXN.TRIAL_ENABLED"},{"equals":["NO"],"field_key":"TXN.DEPOSIT_ENABLED"}]}'::jsonb, true
  WHERE NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key='HORSE_SALE_V2' AND clause_key='TRIAL.RETURN_NODEP');
  -- deposit refunded in full
  INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
  SELECT 'HORSE_SALE_V2', v_sec, 'TRIAL.RETURN_FULL', NULL,
    'If Buyer returns the Horse with approved notice on or before that date, this Agreement terminates and the Deposit of {{TXN.DEPOSIT_AMOUNT}} is refunded in full.',
    'prose', v_ord + 1, false,
    '{"all":[{"equals":["YES"],"field_key":"TXN.TRIAL_ENABLED"},{"equals":["YES"],"field_key":"TXN.DEPOSIT_ENABLED"},{"equals":["FULL"],"field_key":"TXN.TRIAL_DEPOSIT_DISPOSITION"}]}'::jsonb, true
  WHERE NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key='HORSE_SALE_V2' AND clause_key='TRIAL.RETURN_FULL');
  -- deposit partially refunded (with %)
  INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
  SELECT 'HORSE_SALE_V2', v_sec, 'TRIAL.RETURN_PARTIAL', NULL,
    'If Buyer returns the Horse with approved notice on or before that date, this Agreement terminates and the Deposit of {{TXN.DEPOSIT_AMOUNT}} is refunded {{TXN.TRIAL_DEPOSIT_REFUND_PCT}}.',
    'prose', v_ord + 1, false,
    '{"all":[{"equals":["YES"],"field_key":"TXN.TRIAL_ENABLED"},{"equals":["YES"],"field_key":"TXN.DEPOSIT_ENABLED"},{"equals":["PARTIAL"],"field_key":"TXN.TRIAL_DEPOSIT_DISPOSITION"}]}'::jsonb, true
  WHERE NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key='HORSE_SALE_V2' AND clause_key='TRIAL.RETURN_PARTIAL');
  -- deposit not refunded
  INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
  SELECT 'HORSE_SALE_V2', v_sec, 'TRIAL.RETURN_NONE', NULL,
    'If Buyer returns the Horse with approved notice on or before that date, this Agreement terminates and the Deposit of {{TXN.DEPOSIT_AMOUNT}} is not refunded.',
    'prose', v_ord + 1, false,
    '{"all":[{"equals":["YES"],"field_key":"TXN.TRIAL_ENABLED"},{"equals":["YES"],"field_key":"TXN.DEPOSIT_ENABLED"},{"equals":["NONE"],"field_key":"TXN.TRIAL_DEPOSIT_DISPOSITION"}]}'::jsonb, true
  WHERE NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key='HORSE_SALE_V2' AND clause_key='TRIAL.RETURN_NONE');
  -- the "not returned" sentence — always, after the deposit-return sentence
  INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
  SELECT 'HORSE_SALE_V2', v_sec, 'TRIAL.NOT_RETURNED', NULL,
    'If the Horse is not returned and no such notice is given by that date, Buyer is deemed to have accepted the Horse and Closing proceeds under this Agreement.',
    'prose', v_ord + 2, false,
    '{"equals":["YES"],"field_key":"TXN.TRIAL_ENABLED"}'::jsonb, true
  WHERE NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key='HORSE_SALE_V2' AND clause_key='TRIAL.NOT_RETURNED');
END $cr126_trial$;

-- ── B11: delivery — transport conditional + seller-delay penalty ─────────────
-- New TXN.TRANSPORT_NEEDED select (either party) that gates the transport sentence:
-- the author sets it Yes when the delivery location differs from the trial/current
-- location, No when they match (the transport content is then omitted).
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   format_type, options, conditional_on, required, is_optional, sort_order, closed, guidance)
SELECT 'HORSE_SALE_V2', 'TXN.TRANSPORT_NEEDED', 'Transport to a different location required', 'DELIVERY', 'DEAL',
       'select', 'select', 'select',
       '[{"label":"Yes","value":"YES"},{"label":"No","value":"NO"}]'::jsonb,
       NULL, true, false, 425, false,
       'Yes when the delivery location differs from the trial location (or the horse''s current location if there is no trial); No when they are the same — the transport terms are then omitted.'
 WHERE NOT EXISTS (SELECT 1 FROM contract_field_defs
                    WHERE template_key='HORSE_SALE_V2' AND field_key='TXN.TRANSPORT_NEEDED');

-- New seller-delay fee (per B1/B9: the BUYER sets the fee Seller pays for delay).
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   format_type, required, is_optional, sort_order, closed, guidance)
SELECT 'HORSE_SALE_V2', 'TXN.SELLER_DELAY_PENALTY', 'Seller-delay penalty (per day)', 'DELIVERY', 'BUYER',
       'currency', 'currency', 'currency', true, false, 455, false, NULL
 WHERE NOT EXISTS (SELECT 1 FROM contract_field_defs
                    WHERE template_key='HORSE_SALE_V2' AND field_key='TXN.SELLER_DELAY_PENALTY');

-- DELIVERY.TERMS: the transport sentence is its own line, gated on TRANSPORT_NEEDED
-- = YES (line-gating omits it when the locations match); the buyer-delay sentence
-- keeps; a seller-delay penalty sentence is added.
UPDATE contract_clause_defs
   SET body = 'The Horse shall be delivered to Buyer at {{TXN.DELIVERY_LOCATION}} on or about {{TXN.DELIVERY_DATE}}.
Transport is arranged by {{TXN.TRANSPORT_RESPONSIBLE}} and paid for by {{TXN.TRANSPORT_COST_RESPONSIBLE}}.
If Buyer fails to take delivery within 7 days of the agreed date other than due to Seller''s delay, Buyer shall pay board and care for the Horse at {{TXN.BOARD_RATE_AFTER}} per day until delivery occurs.
If Seller delays delivery by more than 7 days, Seller shall pay {{TXN.SELLER_DELAY_PENALTY}} penalty to Buyer per day until delivery occurs.'
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'DELIVERY.TERMS';

-- The transport line's TRANSPORT_RESPONSIBLE / TRANSPORT_COST_RESPONSIBLE fields
-- must gate on TRANSPORT_NEEDED = YES so the whole line drops when transport is
-- not required (line-gating keys off any token field's conditional_on).
UPDATE contract_field_defs
   SET conditional_on = '{"equals":["YES"],"field_key":"TXN.TRANSPORT_NEEDED"}'::jsonb
 WHERE template_key = 'HORSE_SALE_V2'
   AND field_key IN ('TXN.TRANSPORT_RESPONSIBLE','TXN.TRANSPORT_COST_RESPONSIBLE');

-- ── B12: transfer-fees responsible → add Not Applicable ──────────────────────
UPDATE contract_field_defs
   SET options = '[{"label":"Buyer","value":"BUYER"},{"label":"Seller","value":"SELLER"},{"label":"Other","value":"OTHER"},{"label":"Not Applicable","value":"NA"}]'::jsonb
 WHERE template_key = 'HORSE_SALE_V2' AND field_key = 'TXN.TRANSFER_FEES_RESPONSIBLE';

-- ── B13: the acknowledgments become REQUIRED ─────────────────────────────────
UPDATE contract_field_defs SET required = true
 WHERE template_key = 'HORSE_SALE_V2'
   AND field_key IN ('TXN.NO_SLAUGHTER_ACK','TXN.BUYER_ACCEPTS_DISCLOSURES');
