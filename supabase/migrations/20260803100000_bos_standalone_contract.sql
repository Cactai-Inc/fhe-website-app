/*
  # HORSE_BILL_OF_SALE — standalone posture becomes a self-supporting contract

  Stage 0 of the deal plan (L15–L19). Authored from
  docs/contract-content/HORSE_BILL_OF_SALE_STANDALONE_ADDENDUM.md; bodies load
  VERBATIM from that file. Merged language comes from HORSE_SALE_V2's vetted
  clauses, rewritten for the bill of sale's own terms:
    - "Closing" is undefined here → delivery is the operative moment.
    - "Seller Parties" is undefined here → released parties named inline.

  Idempotent: DELETEs the rows it owns before inserting (the lease/sale seed
  precedent), scoped to the clause/field/section keys this migration introduces
  or replaces. Nothing outside HORSE_BILL_OF_SALE is touched.

  Owner rulings encoded here:
    L15 notary removed entirely (returns with the sworn-affidavit doc, deferred).
    L18.2 release/§1542 is ELECTIVE and renders NOTHING when not included — a
          deliberate departure from this document set's "considered and declined"
          convention. Do not "fix" it.
    L19 the as-is disclaimer is never toggled off; it carves out the express
        representations (UCC §2-316: a disclaimer contradicting an express
        warranty is resolved against the seller).
*/

-- ── CHANGE 1: notary out ─────────────────────────────────────────────────────
DELETE FROM contract_clause_defs
 WHERE template_key = 'HORSE_BILL_OF_SALE' AND clause_key = 'BOS_SIGNATURES.NOTARY';
DELETE FROM contract_field_defs
 WHERE template_key = 'HORSE_BILL_OF_SALE' AND field_key = 'TXN.NOTARY_ELECTION';

-- ── new sections ─────────────────────────────────────────────────────────────
DELETE FROM contract_section_defs
 WHERE template_key = 'HORSE_BILL_OF_SALE'
   AND section_key IN ('BOS_DISCLOSURES','BOS_DELIVERY','BOS_RELEASE');
INSERT INTO contract_section_defs (template_key, section_key, heading, sort_order) VALUES
  ('HORSE_BILL_OF_SALE','BOS_DISCLOSURES','Seller''s Disclosures',      45),
  ('HORSE_BILL_OF_SALE','BOS_DELIVERY',   'Delivery and Risk of Loss',  55),
  ('HORSE_BILL_OF_SALE','BOS_RELEASE',    'Release of Claims',          57);

-- ── clauses this migration owns (replace) ────────────────────────────────────
DELETE FROM contract_clause_defs
 WHERE template_key = 'HORSE_BILL_OF_SALE'
   AND (section_key IN ('BOS_DISCLOSURES','BOS_DELIVERY','BOS_RELEASE')
        OR clause_key IN ('BOS_WARRANTY.CONDITION_STANDALONE',
                          'BOS_GOVERNING.CHOICE','BOS_GOVERNING.STANDALONE',
                          'BOS_GOVERNING.PENDING'));

-- CHANGE 2: as-is disclaimer with the express-representation carve-out
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, conditional_on) VALUES
  ('HORSE_BILL_OF_SALE','BOS_WARRANTY','BOS_WARRANTY.CONDITION_STANDALONE', NULL,
   $BODY$Except for the warranty of title above and the representations expressly stated in this Bill of Sale, the Horse is sold AS IS, and SELLER MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE HORSE, INCLUDING THE WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE, and no warranty is made regarding the Horse's future soundness, health, temperament, performance, suitability for any discipline or rider, or value. This disclaimer does not limit claims arising from fraud or from breach of the express representations stated in this Bill of Sale. Buyer acknowledges the opportunity to have the Horse examined by a veterinarian of Buyer's choosing before purchase.$BODY$,
   'prose', 30, '{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb);

-- CHANGE 3: Seller's Disclosures (standalone posture only)
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, conditional_on) VALUES
  ('HORSE_BILL_OF_SALE','BOS_DISCLOSURES','BOS_DISCLOSURES.HEALTH','Health and Condition Disclosures',
   $BODY$Seller has disclosed to Buyer all known material information regarding the Horse's medical conditions, injuries, lameness history, surgeries, allergies, current and past medications, behavioral issues, vices, and prior veterinary concerns, as follows: {{TXN.KNOWN_CONDITIONS}}. Seller represents that these disclosures are true and complete to Seller's knowledge as of the date of this Bill of Sale.$BODY$,
   'input', 10, '{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb),

  ('HORSE_BILL_OF_SALE','BOS_DISCLOSURES','BOS_DISCLOSURES.BEHAVIOR','Behavior',
   $BODY$Seller represents that, to Seller's knowledge, the Horse has no history of dangerous or vicious behavior as of the date of this Bill of Sale, except as disclosed in this Bill of Sale.$BODY$,
   'prose', 20, '{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb),

  ('HORSE_BILL_OF_SALE','BOS_DISCLOSURES','BOS_DISCLOSURES.INJURY_NONE','No Serious Injury History',
   $BODY$Seller represents that, to Seller's knowledge, no person or animal has suffered serious injury proximately caused by the direct actions of the Horse, including biting, kicking, striking, bucking, rearing, bolting, crushing, or throwing a rider. This representation does not extend to any incident caused primarily by a third party or an external stimulus — such as another horse or rider being at fault, a loose dog, wildlife, a vehicle, or a similar external provocation — where the Horse's reaction was within the range of normal equine behavior.$BODY$,
   'prose', 30, '{"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["NO"], "field_key": "TXN.INJURY_HISTORY"}]}'::jsonb),

  ('HORSE_BILL_OF_SALE','BOS_DISCLOSURES','BOS_DISCLOSURES.INJURY_DISCLOSED','Serious Injury History Disclosed',
   $BODY$Seller discloses that one or more persons or animals have suffered serious injury involving the direct actions of the Horse, as follows, including for each incident the approximate date, the circumstances, the Horse's actions, and the nature of the injury: {{TXN.INJURY_HISTORY_DETAILS}}. Buyer acknowledges this disclosure and proceeds with knowledge of it.$BODY$,
   'input', 40, '{"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["YES"], "field_key": "TXN.INJURY_HISTORY"}]}'::jsonb),

  ('HORSE_BILL_OF_SALE','BOS_DISCLOSURES','BOS_DISCLOSURES.INJURY_PENDING', NULL,
   $BODY$[Pending — state whether anyone or any animal has been seriously injured by the Horse's direct actions. This placeholder is replaced by the applicable statement and blocks signing.]$BODY$,
   'prose', 50, '{"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": [""], "field_key": "TXN.INJURY_HISTORY"}]}'::jsonb),

  ('HORSE_BILL_OF_SALE','BOS_DISCLOSURES','BOS_DISCLOSURES.ENCUMBRANCES','Disclosed Encumbrances and Interests',
   $BODY$Seller discloses the following liens, leases, co-ownership interests, or other encumbrances affecting the Horse, each of which is released or satisfied at or before delivery unless expressly stated otherwise: {{TXN.DISCLOSED_ENCUMBRANCES}}$BODY$,
   'input', 60, '{"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["YES"], "field_key": "TXN.HAS_ENCUMBRANCES"}]}'::jsonb),

  ('HORSE_BILL_OF_SALE','BOS_DISCLOSURES','BOS_DISCLOSURES.ENCUMBRANCES_PENDING', NULL,
   $BODY$[Pending — state whether any liens, leases, or other encumbrances affect the Horse. This placeholder is replaced by the applicable statement and blocks signing.]$BODY$,
   'prose', 70, '{"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": [""], "field_key": "TXN.HAS_ENCUMBRANCES"}]}'::jsonb);

-- CHANGE 4: Delivery and Risk of Loss (standalone posture only)
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, conditional_on) VALUES
  ('HORSE_BILL_OF_SALE','BOS_DELIVERY','BOS_DELIVERY.TERMS','Delivery',
   $BODY$The Horse is delivered to Buyer at {{TXN.DELIVERY_LOCATION}} on or about {{TXN.DELIVERY_DATE}}. Transport is arranged by {{TXN.TRANSPORT_RESPONSIBLE}} and paid for by {{TXN.TRANSPORT_COST_RESPONSIBLE}}. If Buyer fails to take delivery within 7 days of the agreed date other than due to Seller's delay, Buyer shall pay board and care for the Horse at {{TXN.BOARD_RATE_AFTER}} per day until delivery occurs, and risk of loss passes to Buyer on the 8th day.$BODY$,
   'input', 10, '{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb),

  ('HORSE_BILL_OF_SALE','BOS_DELIVERY','BOS_DELIVERY.RISK','Transfer of Title and Risk',
   $BODY$Title to the Horse passes to Buyer as provided in the Conveyance section above, and risk of loss of or injury to the Horse passes to Buyer upon delivery. This executed Bill of Sale constitutes the instrument of transfer for the Horse, and Seller shall execute any additional transfer document reasonably required by a breed registry, microchip registry, or passport authority.$BODY$,
   'prose', 20, '{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb),

  ('HORSE_BILL_OF_SALE','BOS_DELIVERY','BOS_DELIVERY.PAPERS','Registration and Transfer Documents',
   $BODY$At delivery (or, where installment payment applies, upon payment in full), Seller shall deliver to Buyer the Horse's registration papers, passport, and any transfer forms required to record the change of ownership, executed by Seller where signature is required. Each party shall cooperate to complete breed registry, microchip registry, and passport transfers promptly, with recording fees paid by {{TXN.TRANSFER_FEES_RESPONSIBLE}}.$BODY$,
   'input', 30, '{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb);

-- CHANGE 5: Release of Claims — ELECTIVE, renders nothing when not included
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, conditional_on) VALUES
  ('HORSE_BILL_OF_SALE','BOS_RELEASE','BOS_RELEASE.BUYER','Release by Buyer',
   $BODY$Buyer, on behalf of Buyer and anyone claiming by, through, or under Buyer, completely releases, forever discharges, and agrees to hold harmless Seller and Seller's family members, employees, agents, contractors, successors, and assigns, to the fullest extent permitted by law, from any and all claims, demands, causes of action, liabilities, or damages for personal injury, property damage, or wrongful death arising out of Buyer's examination, trial, handling, riding, or transport of the Horse before delivery, whether caused by the ordinary negligence of any released party or otherwise, and from any and all claims arising after delivery relating to the Horse's condition, soundness, behavior, suitability, or value. This release does not apply to gross negligence, reckless conduct, intentional misconduct, fraud, or breach of the express representations stated in this Bill of Sale.$BODY$,
   'prose', 10, '{"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["INCLUDED"], "field_key": "TXN.BOS_RELEASE_ELECTION"}]}'::jsonb),

  ('HORSE_BILL_OF_SALE','BOS_RELEASE','BOS_RELEASE.POST_DELIVERY','Post-Delivery Responsibility',
   $BODY$From and after delivery, the Horse and its actions, behavior, care, and condition are the sole responsibility of Buyer, and Buyer shall indemnify, defend, and hold harmless Seller and Seller's family members, employees, agents, contractors, successors, and assigns from and against any claim, damage, loss, liability, cost, or expense arising out of the Horse or its use, handling, care, or possession after delivery, except to the extent caused by the gross negligence, reckless conduct, intentional misconduct, or fraud of a released party or by breach of the express representations stated in this Bill of Sale.$BODY$,
   'prose', 20, '{"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["INCLUDED"], "field_key": "TXN.BOS_RELEASE_ELECTION"}]}'::jsonb),

  ('HORSE_BILL_OF_SALE','BOS_RELEASE','BOS_RELEASE.WAIVER_UNKNOWN','Waiver of Unknown Claims',
   $BODY$Each party, on behalf of itself and anyone claiming by, through, or under it, expressly waives any and all claims released under this Bill of Sale that the waiving party does not know or suspect to exist in its favor at the time of this Bill of Sale. Each party acknowledges that it is familiar with, and expressly waives the protections of, California Civil Code Section 1542, which provides: "A general release does not extend to claims that the creditor or releasing party does not know or suspect to exist in his or her favor at the time of executing the release and that, if known by him or her, would have materially affected his or her settlement with the debtor or released party." Each party assumes the risk that claims presently unknown to it may later be discovered, and acknowledges that this waiver is a material term of this Bill of Sale. This waiver does not apply to claims arising from fraud or from breach of the express representations stated in this Bill of Sale.$BODY$,
   'prose', 30, '{"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["INCLUDED"], "field_key": "TXN.BOS_RELEASE_ELECTION"}]}'::jsonb);

-- CHANGE 6: governing law — posture-specific (defect fix)
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, conditional_on) VALUES
  ('HORSE_BILL_OF_SALE','BOS_GOVERNING','BOS_GOVERNING.CHOICE', NULL,
   $BODY$This Bill of Sale is governed by the laws of the State of California. Any dispute arising out of or relating to this Bill of Sale shall be resolved in the same manner as disputes under the parties' Horse Sale and Purchase Agreement, with the same small-claims and provisional-relief rights stated in that Agreement.$BODY$,
   'prose', 10, '{"equals": ["YES"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb),

  ('HORSE_BILL_OF_SALE','BOS_GOVERNING','BOS_GOVERNING.STANDALONE', NULL,
   $BODY$This Bill of Sale is governed by the laws of the State of California, without regard to conflict-of-laws principles. Any dispute arising out of or relating to this Bill of Sale or the Horse shall be resolved by final and binding arbitration in San Diego County, California, before a single arbitrator administered by JAMS under its applicable rules, or another administrator the parties agree to in writing, with arbitrator fees and administrative costs allocated as those rules provide. Either party may bring a qualifying claim in small claims court, and either party may seek provisional or injunctive relief, including recovery of possession of the Horse, in a court of competent jurisdiction without waiving arbitration. Judgment on the award may be entered in any court having jurisdiction.$BODY$,
   'prose', 20, '{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb),

  ('HORSE_BILL_OF_SALE','BOS_GOVERNING','BOS_GOVERNING.PENDING', NULL,
   $BODY$[Pending — state whether a Horse Sale and Purchase Agreement accompanies this Bill of Sale. This placeholder is replaced by the applicable governing-law terms and blocks signing.]$BODY$,
   'prose', 30, '{"equals": [""], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb);

-- ── field defs for the new sections ──────────────────────────────────────────
DELETE FROM contract_field_defs
 WHERE template_key = 'HORSE_BILL_OF_SALE'
   AND field_key IN ('TXN.KNOWN_CONDITIONS','TXN.INJURY_HISTORY','TXN.INJURY_HISTORY_DETAILS',
                     'TXN.HAS_ENCUMBRANCES','TXN.DISCLOSED_ENCUMBRANCES',
                     'TXN.DELIVERY_LOCATION','TXN.DELIVERY_DATE','TXN.TRANSPORT_RESPONSIBLE',
                     'TXN.TRANSPORT_COST_RESPONSIBLE','TXN.BOARD_RATE_AFTER',
                     'TXN.TRANSFER_FEES_RESPONSIBLE','TXN.BOS_RELEASE_ELECTION');

INSERT INTO contract_field_defs (template_key, field_key, label, section, clause_key, owner_role, value_type, input_kind, format_type, options, conditional_on, required, sort_order) VALUES
  -- disclosures (owner SELLER)
  ('HORSE_BILL_OF_SALE','TXN.KNOWN_CONDITIONS','Known conditions and history','BOS_DISCLOSURES','BOS_DISCLOSURES.HEALTH','SELLER','longtext','longtext','longtext',NULL,
   '{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb, true, 6010),
  ('HORSE_BILL_OF_SALE','TXN.INJURY_HISTORY','Has anyone or any animal been seriously injured by the Horse''s direct actions?','BOS_DISCLOSURES','BOS_DISCLOSURES.INJURY_PENDING','SELLER','select','select','select',
   '[{"label": "Yes", "value": "YES"}, {"label": "No", "value": "NO"}]'::jsonb,
   '{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb, true, 6020),
  ('HORSE_BILL_OF_SALE','TXN.INJURY_HISTORY_DETAILS','Injury history details','BOS_DISCLOSURES','BOS_DISCLOSURES.INJURY_DISCLOSED','SELLER','longtext','longtext','longtext',NULL,
   '{"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["YES"], "field_key": "TXN.INJURY_HISTORY"}]}'::jsonb, true, 6030),
  ('HORSE_BILL_OF_SALE','TXN.HAS_ENCUMBRANCES','Any liens, leases, or other encumbrances?','BOS_DISCLOSURES','BOS_DISCLOSURES.ENCUMBRANCES_PENDING','SELLER','select','select','select',
   '[{"label": "Yes", "value": "YES"}, {"label": "No", "value": "NO"}]'::jsonb,
   '{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb, true, 6040),
  ('HORSE_BILL_OF_SALE','TXN.DISCLOSED_ENCUMBRANCES','Encumbrance details','BOS_DISCLOSURES','BOS_DISCLOSURES.ENCUMBRANCES','SELLER','longtext','longtext','longtext',NULL,
   '{"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["YES"], "field_key": "TXN.HAS_ENCUMBRANCES"}]}'::jsonb, true, 6050),
  -- delivery (owner DEAL)
  ('HORSE_BILL_OF_SALE','TXN.DELIVERY_LOCATION','Delivery location','BOS_DELIVERY','BOS_DELIVERY.TERMS','DEAL','text','text','text',NULL,
   '{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb, true, 6110),
  ('HORSE_BILL_OF_SALE','TXN.DELIVERY_DATE','Delivery date','BOS_DELIVERY','BOS_DELIVERY.TERMS','DEAL','date','date','date',NULL,
   '{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb, true, 6120),
  ('HORSE_BILL_OF_SALE','TXN.TRANSPORT_RESPONSIBLE','Transport arranged by','BOS_DELIVERY','BOS_DELIVERY.TERMS','DEAL','select','select','select',
   '[{"label": "Buyer", "value": "BUYER"}, {"label": "Seller", "value": "SELLER"}]'::jsonb,
   '{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb, true, 6130),
  ('HORSE_BILL_OF_SALE','TXN.TRANSPORT_COST_RESPONSIBLE','Transport paid by','BOS_DELIVERY','BOS_DELIVERY.TERMS','DEAL','select','select','select',
   '[{"label": "Buyer", "value": "BUYER"}, {"label": "Seller", "value": "SELLER"}]'::jsonb,
   '{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb, true, 6140),
  ('HORSE_BILL_OF_SALE','TXN.BOARD_RATE_AFTER','Board rate after missed delivery (per day)','BOS_DELIVERY','BOS_DELIVERY.TERMS','DEAL','currency','currency','currency',NULL,
   '{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb, true, 6150),
  ('HORSE_BILL_OF_SALE','TXN.TRANSFER_FEES_RESPONSIBLE','Registry transfer fees','BOS_DELIVERY','BOS_DELIVERY.PAPERS','DEAL','select','select','select',
   '[{"label": "Buyer", "value": "BUYER"}, {"label": "Seller", "value": "SELLER"}]'::jsonb,
   '{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb, true, 6160),
  -- release election (owner DEAL) — NOT_INCLUDED renders nothing at all
  ('HORSE_BILL_OF_SALE','TXN.BOS_RELEASE_ELECTION','Release of claims and waiver of unknown claims','BOS_RELEASE','BOS_RELEASE.BUYER','DEAL','select','select','select',
   '[{"label": "Included", "value": "INCLUDED"}, {"label": "Not included", "value": "NOT_INCLUDED"}]'::jsonb,
   '{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb, true, 6210);
