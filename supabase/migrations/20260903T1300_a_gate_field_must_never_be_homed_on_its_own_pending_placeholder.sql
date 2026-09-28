/*
  CR-119-A follow-up, same day. Reported by the owner testing the co-buyer fix:
  "when no is selected the selection field menu disappears and you cant change
  your answer." Not a symptom of the new button — the underlying select field
  itself, reached the plain way (the PARTIES-section dropdown), does this too.

  ROOT CAUSE. A "*_PENDING" clause exists per gated question purely to print a
  "[Pending — state whether …]" placeholder while the question is unanswered.
  ClauseDocument.tsx's isUnansweredPlaceholder() (:360-366) deliberately drops
  such a clause from clausesToShow once its condition ({"equals":[""],...})
  stops holding — "dead weight once its question is answered" — BEFORE the
  self-hosted-trigger carve-out (gateControls, :1171-1188/:1239-1243) ever runs,
  because that carve-out only applies to clauses that make it into clausesToShow.
  That's correct for a PURE placeholder. It's wrong when contract_field_defs
  also homes the answering field itself on that same clause_key: the moment the
  field gets ANY value (Yes or No), its own hosting clause disappears — taking
  the only control that could ever change the answer with it. There is no
  other place in the document that renders {{TXN.CO_BUYER_ENABLED}} or its
  siblings below; once gone, gone for good, confirmed against production (the
  live stuck document 80537662-7b4e-4adc-9ebc-49ed9d2bed78 is sitting in
  exactly this state right now).

  The Bill of Sale's own co-buyer field never had this problem: it's homed on
  PARTIES.CO_BUYER-equivalent content (gated on a real value, not on ""), which
  IS eligible for the gateControls carve-out, so its control stays visible and
  clickable even while gated off. That's the fix, generalized: never home a
  gate field on a clause whose own condition is "this field is blank."

  SCAN (owner-directed, all templates, all field defs): a field def is affected
  when its clause_key resolves to a clause whose conditional_on tests THIS
  field against "" — either directly ({"equals":[""],"field_key":<self>}) or
  as one branch of an "all"/"any" compound. 10 field defs on 2 templates
  matched; every *_PENDING clause on the 4 lease templates and 2 more BOS/SALE
  fields were checked and do NOT home their own trigger field, so they are
  correctly-used placeholders and are untouched.

  FIX: re-point each field's clause_key at the nearest real content clause in
  the SAME section that the placeholder sat in — a clause gated on an actual
  value of the field, never "". gateTriggerKeys() (:280-292) already walks
  into "all"/"any", so a field is recognized as a trigger of a compound-gated
  clause too (HAS_ENCUMBRANCES, BOS's INJURY_HISTORY) — the carve-out applies
  the same way. Nothing about the placeholder clauses themselves changes: they
  still print their "[Pending — …]" text while genuinely unanswered; they just
  no longer double as a field's only home.

  Then repair the 5 contract_fields rows already carrying the stale clause_key
  in production — all 5 belong to 80537662-7b4e-4adc-9ebc-49ed9d2bed78, the one
  document that had reached this state (checked: zero Bill-of-Sale documents
  had reached theirs). No contract_field_defs row or document body text
  changes — this only moves which clause a field's control renders under.
*/

-- ── 1. contract_field_defs — future documents seed with the right home ──────
UPDATE contract_field_defs SET clause_key = 'PARTIES.CO_BUYER'
 WHERE template_key = 'HORSE_SALE_V2' AND field_key = 'TXN.CO_BUYER_ENABLED'
   AND clause_key = 'PARTIES.CO_BUYER_PENDING';

UPDATE contract_field_defs SET clause_key = 'HORSE.INJURY_HISTORY_NONE'
 WHERE template_key = 'HORSE_SALE_V2' AND field_key = 'TXN.INJURY_HISTORY'
   AND clause_key = 'HORSE.INJURY_HISTORY_PENDING';

UPDATE contract_field_defs SET clause_key = 'PRICE.FULL_PAYMENT'
 WHERE template_key = 'HORSE_SALE_V2' AND field_key = 'TXN.INSTALLMENTS_ENABLED'
   AND clause_key = 'PRICE.INSTALLMENTS_PENDING';

UPDATE contract_field_defs SET clause_key = 'PPE.CONDUCTED'
 WHERE template_key = 'HORSE_SALE_V2' AND field_key = 'TXN.PPE_CHOICE'
   AND clause_key = 'PPE.PENDING';

UPDATE contract_field_defs SET clause_key = 'TRIAL.TERMS'
 WHERE template_key = 'HORSE_SALE_V2' AND field_key = 'TXN.TRIAL_ENABLED'
   AND clause_key = 'TRIAL.PENDING';

UPDATE contract_field_defs SET clause_key = 'BOS_AGENT.DISCLOSURE'
 WHERE template_key = 'HORSE_BILL_OF_SALE' AND field_key = 'TXN.AGENT_ELECTION'
   AND clause_key = 'BOS_AGENT.PENDING';

UPDATE contract_field_defs SET clause_key = 'BOS_WARRANTY.CONDITION_XREF'
 WHERE template_key = 'HORSE_BILL_OF_SALE' AND field_key = 'TXN.BOS_HAS_SALE_AGREEMENT'
   AND clause_key = 'BOS_WARRANTY.PENDING';

UPDATE contract_field_defs SET clause_key = 'BOS_CONVEYANCE.PAID'
 WHERE template_key = 'HORSE_BILL_OF_SALE' AND field_key = 'TXN.BOS_PAYMENT_STATUS'
   AND clause_key = 'BOS_CONVEYANCE.PENDING';

UPDATE contract_field_defs SET clause_key = 'BOS_DISCLOSURES.ENCUMBRANCES'
 WHERE template_key = 'HORSE_BILL_OF_SALE' AND field_key = 'TXN.HAS_ENCUMBRANCES'
   AND clause_key = 'BOS_DISCLOSURES.ENCUMBRANCES_PENDING';

UPDATE contract_field_defs SET clause_key = 'BOS_DISCLOSURES.INJURY_NONE'
 WHERE template_key = 'HORSE_BILL_OF_SALE' AND field_key = 'TXN.INJURY_HISTORY'
   AND clause_key = 'BOS_DISCLOSURES.INJURY_PENDING';

-- ── 2. contract_fields — repair documents already carrying the stale home ──
-- Same (template_key via document, field_key, old clause_key -> new clause_key)
-- pairing as above, applied by field_key + the exact stale clause_key so this
-- can never touch a row that was already correct.
UPDATE contract_fields SET clause_key = 'PARTIES.CO_BUYER', updated_at = now()
 WHERE field_key = 'TXN.CO_BUYER_ENABLED' AND clause_key = 'PARTIES.CO_BUYER_PENDING';

UPDATE contract_fields SET clause_key = 'HORSE.INJURY_HISTORY_NONE', updated_at = now()
 WHERE field_key = 'TXN.INJURY_HISTORY' AND clause_key = 'HORSE.INJURY_HISTORY_PENDING';

UPDATE contract_fields SET clause_key = 'PRICE.FULL_PAYMENT', updated_at = now()
 WHERE field_key = 'TXN.INSTALLMENTS_ENABLED' AND clause_key = 'PRICE.INSTALLMENTS_PENDING';

UPDATE contract_fields SET clause_key = 'PPE.CONDUCTED', updated_at = now()
 WHERE field_key = 'TXN.PPE_CHOICE' AND clause_key = 'PPE.PENDING';

UPDATE contract_fields SET clause_key = 'TRIAL.TERMS', updated_at = now()
 WHERE field_key = 'TXN.TRIAL_ENABLED' AND clause_key = 'TRIAL.PENDING';

UPDATE contract_fields SET clause_key = 'BOS_AGENT.DISCLOSURE', updated_at = now()
 WHERE field_key = 'TXN.AGENT_ELECTION' AND clause_key = 'BOS_AGENT.PENDING';

UPDATE contract_fields SET clause_key = 'BOS_WARRANTY.CONDITION_XREF', updated_at = now()
 WHERE field_key = 'TXN.BOS_HAS_SALE_AGREEMENT' AND clause_key = 'BOS_WARRANTY.PENDING';

UPDATE contract_fields SET clause_key = 'BOS_CONVEYANCE.PAID', updated_at = now()
 WHERE field_key = 'TXN.BOS_PAYMENT_STATUS' AND clause_key = 'BOS_CONVEYANCE.PENDING';

UPDATE contract_fields SET clause_key = 'BOS_DISCLOSURES.ENCUMBRANCES', updated_at = now()
 WHERE field_key = 'TXN.HAS_ENCUMBRANCES' AND clause_key = 'BOS_DISCLOSURES.ENCUMBRANCES_PENDING';

UPDATE contract_fields SET clause_key = 'BOS_DISCLOSURES.INJURY_NONE', updated_at = now()
 WHERE field_key = 'TXN.INJURY_HISTORY' AND clause_key = 'BOS_DISCLOSURES.INJURY_PENDING';
