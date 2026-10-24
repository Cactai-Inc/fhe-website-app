-- Disclosure rebuild, phase 24: final approved disclosure wording.
-- Runs AFTER disc_18-23. Hand-authored per the owner's approval (2026-10-23):
--   1.1  rename "Behavioral concerns" -> "Behavior Disclosure" (gate label), and the
--        behavior clause wording to "adverse behaviors".
--   1.2  all 21 NONE clauses conform to the approved forms, per section.
--   1.5  gate + imported-field helper/guidance rewritten for the current model.
-- The human-injury NONE/DISCLOSED/UNKNOWN final wording is already set in disc_21;
-- this phase sets the other six sections' NONE clauses and the behavior rename.

-- ── 1.1  Behavior rename: gate labels (all three documents) ──
UPDATE contract_field_defs SET label = 'Behavior disclosure — anything to disclose?'
 WHERE field_key IN ('HORSE.BEHAVIORAL_HISTORY_GATE') AND template_key IN ('HORSE_LEASE_V3','HORSE_SALE_V3','HORSE_BILL_OF_SALE');

-- ── 1.2  NONE clauses (the six non-human-injury sections) ──
-- Known conditions: "no known conditions, meaning <list>, to disclose as of <date>."
UPDATE contract_clause_defs SET body =
  'Lessor represents that, to Lessor''s knowledge, the Horse has no known conditions, meaning medical conditions, lameness history, allergies, vices, or prior veterinary concerns, to disclose as of the Effective Date.'
 WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.KNOWN_CONDITIONS_NONE';
UPDATE contract_clause_defs SET body =
  'Seller represents that, to Seller''s knowledge, the Horse has no known conditions, meaning medical conditions, lameness history, allergies, vices, or prior veterinary concerns, to disclose as of the Effective Date. Seller shall promptly disclose any material change arising before Closing.'
 WHERE template_key='HORSE_SALE_V3' AND clause_key='HORSE.KNOWN_CONDITIONS_NONE';
UPDATE contract_clause_defs SET body =
  'Seller represents that, to Seller''s knowledge, the Horse has no known conditions, meaning medical conditions, lameness history, allergies, vices, or prior veterinary concerns, to disclose as of the date of this Bill of Sale.'
 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_KNOWN_CONDITIONS_NONE';

-- Medical history
UPDATE contract_clause_defs SET body =
  'Lessor represents that, to Lessor''s knowledge, the Horse has no medical history (treatments, surgeries, or ongoing monitoring) to disclose as of the Effective Date.'
 WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.MEDICAL_HISTORY_NONE';
UPDATE contract_clause_defs SET body =
  'Seller represents that, to Seller''s knowledge, the Horse has no medical history (treatments, surgeries, or ongoing monitoring) to disclose as of the Effective Date.'
 WHERE template_key='HORSE_SALE_V3' AND clause_key='HORSE.MEDICAL_HISTORY_NONE';
UPDATE contract_clause_defs SET body =
  'Seller represents that, to Seller''s knowledge, the Horse has no medical history (treatments, surgeries, or ongoing monitoring) to disclose as of the date of this Bill of Sale.'
 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_MEDICAL_HISTORY_NONE';

-- Behavior (adverse behaviors)
UPDATE contract_clause_defs SET body =
  'Lessor represents that, to Lessor''s knowledge, the Horse has no adverse behaviors to disclose as of the Effective Date.'
 WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.BEHAVIORAL_HISTORY_NONE';
UPDATE contract_clause_defs SET body =
  'Seller represents that, to Seller''s knowledge, the Horse has no adverse behaviors to disclose as of the Effective Date.'
 WHERE template_key='HORSE_SALE_V3' AND clause_key='HORSE.BEHAVIORAL_HISTORY_NONE';
UPDATE contract_clause_defs SET body =
  'Seller represents that, to Seller''s knowledge, the Horse has no adverse behaviors to disclose as of the date of this Bill of Sale.'
 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_BEHAVIORAL_HISTORY_NONE';

-- Horse injury (template as drafted: "no serious injury to disclose as of <date>")
UPDATE contract_clause_defs SET body =
  'Lessor represents that, to Lessor''s knowledge, the Horse has no serious injury to disclose as of the Effective Date.'
 WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.INJURIES_TO_HORSE_NONE';
UPDATE contract_clause_defs SET body =
  'Seller represents that, to Seller''s knowledge, the Horse has no serious injury to disclose as of the Effective Date.'
 WHERE template_key='HORSE_SALE_V3' AND clause_key='HORSE.INJURIES_TO_HORSE_NONE';
UPDATE contract_clause_defs SET body =
  'Seller represents that, to Seller''s knowledge, the Horse has no serious injury to disclose as of the date of this Bill of Sale.'
 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_INJURIES_TO_HORSE_NONE';

-- Medications
UPDATE contract_clause_defs SET body =
  'Lessor represents that, to Lessor''s knowledge, the Horse has no medications to disclose as of the Effective Date.'
 WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.MEDICATIONS_NONE';
UPDATE contract_clause_defs SET body =
  'Seller represents that, to Seller''s knowledge, the Horse has no medications to disclose as of the Effective Date.'
 WHERE template_key='HORSE_SALE_V3' AND clause_key='HORSE.MEDICATIONS_NONE';
UPDATE contract_clause_defs SET body =
  'Seller represents that, to Seller''s knowledge, the Horse has no medications to disclose as of the date of this Bill of Sale.'
 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_MEDICATIONS_NONE';

-- Supplements
UPDATE contract_clause_defs SET body =
  'Lessor represents that, to Lessor''s knowledge, the Horse has no supplements to disclose as of the Effective Date.'
 WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.SUPPLEMENTS_NONE';
UPDATE contract_clause_defs SET body =
  'Seller represents that, to Seller''s knowledge, the Horse has no supplements to disclose as of the Effective Date.'
 WHERE template_key='HORSE_SALE_V3' AND clause_key='HORSE.SUPPLEMENTS_NONE';
UPDATE contract_clause_defs SET body =
  'Seller represents that, to Seller''s knowledge, the Horse has no supplements to disclose as of the date of this Bill of Sale.'
 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_SUPPLEMENTS_NONE';

-- ── 1.1  Behavior disclosed-clause wording: "adverse behaviors" (all three) ──
-- (disc_20 set these to "adverse behaviors" already; reassert here for the record so
--  the final wording is unambiguous and order-independent.)
UPDATE contract_clause_defs SET body =
  'Lessor discloses the following adverse behaviors, with all known information relating to description, trigger, and current status or date of last occurrence, as follows:' || E'\n' || '{{HORSE.BEHAVIORAL_HISTORY}}'
 WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.BEHAVIORAL_HISTORY_DISCLOSED';
UPDATE contract_clause_defs SET body =
  'Seller discloses the following adverse behaviors, with all known information relating to description, trigger, and current status or date of last occurrence, as follows:' || E'\n' || '{{HORSE.BEHAVIORAL_HISTORY}}'
 WHERE template_key='HORSE_SALE_V3' AND clause_key='HORSE.BEHAVIORAL_HISTORY_DISCLOSED';
UPDATE contract_clause_defs SET body =
  'Seller discloses the following adverse behaviors, with all known information relating to description, trigger, and current status or date of last occurrence, as follows:' || E'\n' || '{{HORSE.BEHAVIORAL_HISTORY}}'
 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_BEHAVIORAL_HISTORY_DISCLOSED';

-- ── 1.5  Gate + imported-field helper/guidance, current model ──
-- The six record-list gates: content is imported from the horse record; additions
-- and changes are made on the record; the gate is set from the record when the
-- record has entries, and answerable here only when the record has none.
UPDATE contract_field_defs SET guidance =
  'Imported from the horse record. This answer is set to Yes and locked when the record has entries in this section; you can answer it here only when the record has none. To add or change what is disclosed, edit the horse record — the contract updates from it.'
 WHERE template_key IN ('HORSE_LEASE_V3','HORSE_SALE_V3','HORSE_BILL_OF_SALE')
   AND field_key IN ('HORSE.KNOWN_CONDITIONS_GATE','HORSE.MEDICAL_HISTORY_GATE','HORSE.BEHAVIORAL_HISTORY_GATE',
                     'HORSE.INJURIES_TO_HORSE_GATE','HORSE.MEDICATIONS_GATE','HORSE.SUPPLEMENTS_GATE');

-- Injuries-to-humans gate: this is a single Yes/No/Unknown answer entered on the
-- horse record (it has no entry list), imported and locked here.
UPDATE contract_field_defs SET guidance =
  'Imported from the horse record, where injuries to a person are recorded as a single Yes, No, or Unknown answer. Set it on the horse record; it is locked here.'
 WHERE template_key IN ('HORSE_LEASE_V3','HORSE_SALE_V3','HORSE_BILL_OF_SALE')
   AND field_key = 'HORSE.INJURIES_TO_HUMANS_GATE';

-- The imported content fields (the {{HORSE.<SECTION>}} tokens): helper names the record.
UPDATE contract_field_defs SET guidance =
  'Imported from the horse record. Add or change entries on the record; the contract updates from it. These entries cannot be edited on the contract.'
 WHERE template_key IN ('HORSE_LEASE_V3','HORSE_SALE_V3','HORSE_BILL_OF_SALE')
   AND field_key IN ('HORSE.KNOWN_CONDITIONS','HORSE.MEDICAL_HISTORY','HORSE.BEHAVIORAL_HISTORY',
                     'HORSE.INJURIES_TO_HORSE','HORSE.MEDICATIONS','HORSE.SUPPLEMENTS');
