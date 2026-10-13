-- CR-126 fix — the trial deposit-disposition selector still did not render when
-- homed on the new (empty) TRIAL.DEPOSIT_CHOICE clause. Home it instead on TRIAL.GATE,
-- the always-visible empty gate clause that already hosts TXN.TRIAL_ENABLED as an
-- orphan control (identical shape to PPE.CHOICE_GATE, which demonstrably renders its
-- orphan selectors). The disposition's own conditional_on (needs a trial + a deposit)
-- still controls when it appears. TRIAL.DEPOSIT_CHOICE is retired (gated impossible,
-- kept per D16) and the return sentences keep their order.
--
-- Unsigned drafts only (D33); template bumped after (D34).

UPDATE contract_field_defs SET clause_key = 'TRIAL.GATE'
 WHERE template_key = 'HORSE_SALE_V2'
   AND field_key IN ('TXN.TRIAL_DEPOSIT_DISPOSITION','TXN.TRIAL_DEPOSIT_REFUND_PCT');

-- retire the now-unused empty host clause (D16: keep, never delete)
UPDATE contract_clause_defs
   SET conditional_on = '{"equals":["__RETIRED__"],"field_key":"TXN.TRIAL_ENABLED"}'::jsonb
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'TRIAL.DEPOSIT_CHOICE';
