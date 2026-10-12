-- CR-126 round 2 — Bill of Sale (HORSE_SALE_V2) PPE / Trial / Delivery cleanup.
--
-- Owner-reported issues, all against unsigned draft documents (0 signatures), so no
-- signed paper is touched (D33). Template wording changes → v4 minted at the end (D34).
-- The two frontend pieces (cost_split control #5, location-aware transport #7, entity
-- signer #8) are wired in the app; this migration builds their field/clause defs.

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ #4 — Trial period must come BEFORE the PPE section                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Trial dates/existence must be established before PPE is read (PPE references them).
UPDATE contract_section_defs SET sort_order = 55
 WHERE template_key = 'HORSE_SALE_V2' AND section_key = 'TRIAL';
-- (PPE stays 60; TRIAL 55 now sorts before it.)

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ #1 — PPE timing: no date picker unless "Date"; tailored follow-on sentence ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- The PPE.CONDUCTED clause becomes FOUR mutually-exclusive variants on PPE_TIMING,
-- so (a) the date input appears only in the Date variant, and (b) the follow-on
-- "Seller shall…" sentence drops "make the Horse reasonably available for the
-- examination" when timing is the evaluation period. The timing SELECT renders in
-- every variant (its {{token}} is in each body), so it is always settable.
--
-- PPE_DEADLINE: gated on Buyer Requested + timing = Date, so it only exists in the
-- Date variant and never shows otherwise.
UPDATE contract_field_defs
   SET conditional_on = '{"all":[{"equals":["BUYER_REQUESTED"],"field_key":"TXN.PPE_CHOICE"},{"equals":["DATE"],"field_key":"TXN.PPE_TIMING"}]}'::jsonb
 WHERE template_key = 'HORSE_SALE_V2' AND field_key = 'TXN.PPE_DEADLINE';

-- Rewrite PPE.CONDUCTED as the DATE variant; add PRIOR_DELIVERY, NONE, and EVAL as
-- siblings. The non-EVAL variants keep the full second sentence; EVAL uses the short one.
-- PPE_TIMING option labels already carry the leading-space phrase; here the variant
-- bodies place {{TXN.PPE_TIMING}} where the phrase belongs.
UPDATE contract_clause_defs
   SET conditional_on = '{"all":[{"equals":["BUYER_REQUESTED"],"field_key":"TXN.PPE_CHOICE"},{"equals":["DATE"],"field_key":"TXN.PPE_TIMING"}]}'::jsonb,
       body = 'Buyer may, at Buyer''s sole cost, have the Horse examined by a licensed veterinarian of Buyer''s choosing{{TXN.PPE_TIMING}} {{TXN.PPE_DEADLINE}}. Seller shall make the Horse reasonably available for the examination and shall disclose the Horse''s known medical history to the examining veterinarian on request.'
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'PPE.CONDUCTED';

INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
SELECT 'HORSE_SALE_V2','PPE','PPE.CONDUCTED_PRIOR', heading,
       'Buyer may, at Buyer''s sole cost, have the Horse examined by a licensed veterinarian of Buyer''s choosing{{TXN.PPE_TIMING}}. Seller shall make the Horse reasonably available for the examination and shall disclose the Horse''s known medical history to the examining veterinarian on request.',
       clause_type, sort_order, is_optional,
       '{"all":[{"equals":["BUYER_REQUESTED"],"field_key":"TXN.PPE_CHOICE"},{"equals":["PRIOR_DELIVERY"],"field_key":"TXN.PPE_TIMING"}]}'::jsonb, render_as_subitem
  FROM contract_clause_defs WHERE template_key='HORSE_SALE_V2' AND clause_key='PPE.CONDUCTED'
   AND NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key='HORSE_SALE_V2' AND clause_key='PPE.CONDUCTED_PRIOR');

INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
SELECT 'HORSE_SALE_V2','PPE','PPE.CONDUCTED_NONE', heading,
       'Buyer may, at Buyer''s sole cost, have the Horse examined by a licensed veterinarian of Buyer''s choosing{{TXN.PPE_TIMING}}. Seller shall make the Horse reasonably available for the examination and shall disclose the Horse''s known medical history to the examining veterinarian on request.',
       clause_type, sort_order, is_optional,
       '{"all":[{"equals":["BUYER_REQUESTED"],"field_key":"TXN.PPE_CHOICE"},{"equals":["NONE"],"field_key":"TXN.PPE_TIMING"}]}'::jsonb, render_as_subitem
  FROM contract_clause_defs WHERE template_key='HORSE_SALE_V2' AND clause_key='PPE.CONDUCTED'
   AND NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key='HORSE_SALE_V2' AND clause_key='PPE.CONDUCTED_NONE');

INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
SELECT 'HORSE_SALE_V2','PPE','PPE.CONDUCTED_EVAL', heading,
       'Buyer may, at Buyer''s sole cost, have the Horse examined by a licensed veterinarian of Buyer''s choosing{{TXN.PPE_TIMING}}. Seller shall disclose the Horse''s known medical history to the examining veterinarian on request.',
       clause_type, sort_order, is_optional,
       '{"all":[{"equals":["BUYER_REQUESTED"],"field_key":"TXN.PPE_CHOICE"},{"equals":["EVAL_PERIOD"],"field_key":"TXN.PPE_TIMING"}]}'::jsonb, render_as_subitem
  FROM contract_clause_defs WHERE template_key='HORSE_SALE_V2' AND clause_key='PPE.CONDUCTED'
   AND NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key='HORSE_SALE_V2' AND clause_key='PPE.CONDUCTED_EVAL');

-- The timing SELECT lives inline in each variant, but a variant renders only when
-- its exact PPE_TIMING value matches — so before the author picks a timing, NO
-- variant shows and the select would be unreachable. Home PPE_TIMING on the empty
-- PPE.CHOICE_GATE clause (s=5) as an orphan control, so it is always visible beneath
-- the Pre-purchase examination selector and the author can set the timing first.
UPDATE contract_field_defs SET clause_key = 'PPE.CHOICE_GATE'
 WHERE template_key = 'HORSE_SALE_V2' AND field_key = 'TXN.PPE_TIMING';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ #2 — "Sale contingent on exam results" select sits ABOVE both paragraphs   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- It is homed on PPE.CONTINGENCY (s=20) so it renders between the two contingency
-- variants. Re-home it on PPE.CHOICE_GATE (s=5) so the control precedes both.
UPDATE contract_field_defs SET clause_key = 'PPE.CHOICE_GATE'
 WHERE template_key = 'HORSE_SALE_V2' AND field_key = 'TXN.PPE_CONTINGENT';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ #3 — Remove the Drug & Substance Testing feature ENTIRELY (owner-confirmed)║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Both clauses retired behind an impossible gate (D16/D32: retire, never delete);
-- the fields retired + un-required so they never block signing.
UPDATE contract_clause_defs
   SET conditional_on = '{"equals":["__RETIRED__"],"field_key":"TXN.DRUG_TEST_ELECTION"}'::jsonb
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key IN ('PPE.DRUG_TESTING','PPE.DRUG_TESTING_DECLINED');
UPDATE contract_field_defs
   SET conditional_on = '{"equals":["__RETIRED__"],"field_key":"TXN.PPE_CHOICE"}'::jsonb,
       required = false
 WHERE template_key = 'HORSE_SALE_V2' AND field_key IN ('TXN.DRUG_TEST_ELECTION','TXN.DRUG_TEST_WINDOW');

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ #6 — The trial deposit-disposition SELECT was homed nowhere → never shown  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Home it on TRIAL.TERMS so it renders as an orphan control right after the trial
-- paragraph and before the deposit-return sentence it gates. TRIAL_DEPOSIT_REFUND_PCT
-- stays with it (same home) so the % input appears alongside when Partial is chosen.
UPDATE contract_field_defs SET clause_key = 'TRIAL.TERMS'
 WHERE template_key = 'HORSE_SALE_V2'
   AND field_key IN ('TXN.TRIAL_DEPOSIT_DISPOSITION','TXN.TRIAL_DEPOSIT_REFUND_PCT');

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ #5 — Trial boarding-cost responsibility (new cost_split structured field)   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Replaces the hardcoded "Buyer bears all costs of the Horse's board…". The costs
-- are borne by an allocation the author sets: Buyer / Seller / a %-split / a
-- $-split (with one side optionally "the remaining cost"). The control is the new
-- cost_split format; compose_field_prose renders the allocation phrase.
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   format_type, conditional_on, required, is_optional, sort_order, closed, guidance)
SELECT 'HORSE_SALE_V2','TXN.TRIAL_BOARD_COST','Trial board & care costs borne by','TRIAL','DEAL',
       'cost_split','text','cost_split',
       '{"equals":["YES"],"field_key":"TXN.TRIAL_ENABLED"}'::jsonb,
       true, false, 365, false, NULL
 WHERE NOT EXISTS (SELECT 1 FROM contract_field_defs
                    WHERE template_key='HORSE_SALE_V2' AND field_key='TXN.TRIAL_BOARD_COST');

-- TRIAL.TERMS first sentence re-worded so the allocation phrase composes cleanly:
-- "the costs of the Horse's board, care, and routine maintenance are borne by
-- {{TXN.TRIAL_BOARD_COST}};". The rest of the clause is unchanged.
UPDATE contract_clause_defs
   SET body = 'Buyer may keep and ride the Horse on trial from {{TXN.TRIAL_START}} to {{TXN.TRIAL_END}} at {{TXN.TRIAL_LOCATION}}. During the trial period: the costs of the Horse''s board, care, and routine maintenance are borne by {{TXN.TRIAL_BOARD_COST}}; Buyer shall use the Horse only for ordinary riding and evaluation consistent with the Horse''s training and shall not compete, breed, transport offsite (other than for veterinary care, which is always permitted), or permit third parties to ride the Horse without Seller''s written consent; and Buyer assumes all risk of injury to persons arising from the Horse during the trial period as provided in the Risk, Release, and Indemnification section of this Agreement. Seller bears the risk of loss of the Horse while Seller holds title. If the Horse dies or is injured before Closing, Buyer is entitled to the return of all amounts paid to Seller and may decline to complete the purchase by not executing the Bill of Sale, in which case Seller returns to Buyer all amounts paid and Buyer returns possession of the Horse to Seller. Nothing in this section limits Seller''s remedies for damage to the Horse caused by Buyer''s gross negligence, reckless conduct, or intentional misconduct. Unless written notice is given and approved by Seller, Buyer must return the Horse in substantially the condition received on or before {{TXN.TRIAL_END}} or execute this Agreement.'
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'TRIAL.TERMS';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ #7 — Location-aware transport gating + trial location                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- TXN.TRANSPORT_NEEDED (the manual Yes/No, homed nowhere → no control) is retired.
-- Transport now gates on a DERIVED field TXN.TRANSPORT_APPLIES computed in
-- recompose_document_fields (see cr126_7 migration) by comparing the delivery
-- location to the handoff origin (trial location if a trial, else the horse's
-- current location). Works for manually-typed addresses because the comparison is
-- over the structured {name,line1,city,state,postal} values.
UPDATE contract_field_defs
   SET conditional_on = '{"equals":["__RETIRED__"],"field_key":"TXN.DELIVERY_LOCATION"}'::jsonb,
       required = false
 WHERE template_key = 'HORSE_SALE_V2' AND field_key = 'TXN.TRANSPORT_NEEDED';

-- Re-gate the transport responsibility fields on the derived TRANSPORT_APPLIES.
UPDATE contract_field_defs
   SET conditional_on = '{"equals":["YES"],"field_key":"TXN.TRANSPORT_APPLIES"}'::jsonb
 WHERE template_key = 'HORSE_SALE_V2'
   AND field_key IN ('TXN.TRANSPORT_RESPONSIBLE','TXN.TRANSPORT_COST_RESPONSIBLE');
