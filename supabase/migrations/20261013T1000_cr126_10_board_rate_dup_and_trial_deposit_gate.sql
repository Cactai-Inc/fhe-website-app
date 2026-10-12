-- CR-126 round 2 fixes — two regressions the owner found once the frontend deployed:
--
-- (1) Board-rate duplication: TXN.BOARD_RATE_AFTER was homed on DELIVERY.TERMS
--     (rendering as an orphan control) AND its {{token}} moved to DELIVERY.DELAYS
--     (rendering inline) — so the author saw the control twice. Clear its clause_key
--     so it renders ONLY inline via its token (as TXN.SELLER_DELAY_PENALTY already does).
--
-- (2) Trial deposit disposition select vanished: it was homed on TRIAL.TERMS, but when
--     the trial is at the current location TRIAL.TERMS is gated off (TRIAL.TERMS_CURRENT
--     shows instead), so the control disappeared and the stored value ("refunded in
--     full") rendered with no way to change it. Move the disposition + % fields to a
--     dedicated clause gated only on TXN.TRIAL_ENABLED, so the control shows in BOTH
--     trial variants, right before the deposit-return sentence it gates.
--
-- Unsigned drafts only (D33); template bumped after (D34).

-- (1) board-rate: render inline only.
UPDATE contract_field_defs SET clause_key = NULL
 WHERE template_key = 'HORSE_SALE_V2' AND field_key = 'TXN.BOARD_RATE_AFTER';

-- (2) a dedicated home for the deposit-disposition controls, visible whenever the
-- trial is on (independent of the location variant). Empty body — it only hosts the
-- orphan controls; the fields' own conditional_on (needs a deposit) decides whether
-- they show. Sorted at 11, just after the trial paragraph (s=10); the return
-- sentences move to 12 so the control precedes them.
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
SELECT 'HORSE_SALE_V2','TRIAL','TRIAL.DEPOSIT_CHOICE', NULL, '', 'prose', 11, false,
       '{"equals":["YES"],"field_key":"TXN.TRIAL_ENABLED"}'::jsonb, false
 WHERE NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key='HORSE_SALE_V2' AND clause_key='TRIAL.DEPOSIT_CHOICE');

UPDATE contract_field_defs SET clause_key = 'TRIAL.DEPOSIT_CHOICE'
 WHERE template_key = 'HORSE_SALE_V2'
   AND field_key IN ('TXN.TRIAL_DEPOSIT_DISPOSITION','TXN.TRIAL_DEPOSIT_REFUND_PCT');

-- push the return sentences + the not-returned sentence past the choice control so
-- the control reads before the sentence it drives (11 = choice, 12 = returns, 13 =
-- not-returned). INSURANCE (15) stays last.
UPDATE contract_clause_defs SET sort_order = 12
 WHERE template_key = 'HORSE_SALE_V2'
   AND clause_key IN ('TRIAL.RETURN_NODEP','TRIAL.RETURN_FULL','TRIAL.RETURN_PARTIAL','TRIAL.RETURN_NONE');
UPDATE contract_clause_defs SET sort_order = 13
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'TRIAL.NOT_RETURNED';
