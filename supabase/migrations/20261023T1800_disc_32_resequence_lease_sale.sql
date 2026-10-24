-- Phase 32: Part 2 resequencing of the HORSE section on the lease and sale.
-- After disc_18-31. Only sort_order changes here (and the disclosure sections move
-- into the Part 1.1 order); no clause text changes, no clause added or removed.
--
-- Part 2.1 Lease HORSE section target order:
--   3.1 Horse Details (identity)
--   3.2 Ownership of the Horse (ownership warranty, co-owners, restrictions)
--   3.3 Lessor's Disclosures (seven sections, Part 1.1 order:
--        Human Injury, Behavior, Horse Injury, Known Conditions, Medical History,
--        Medications, Supplements)
--   3.4 Condition and Behavior (the two warranties + their auto-selected variants)
--   3.5 Disclaimer of Warranties
--   then Location, then the Pre-Lease Examination / Evaluation material.
-- The Part 1.1 disclosure order is shared by all three documents; the sale is
-- resequenced to the same disclosure order below.

-- ── Lease HORSE section ──
-- A helper sets a clause's sort by key (no-op if absent).
DO $seq$
DECLARE
  -- (clause_key, new_sort) pairs in the target order.
  v text[][] := ARRAY[
    -- 3.1 Horse Details
    ['HORSE.IDENTITY','100'],
    -- 3.2 Ownership of the Horse
    ['HORSE.OWNERSHIP','110'],['HORSE.COOWNERS','111'],
    ['HORSE.OWNERSHIP_LIMITS_GATE','112'],['HORSE.OWNERSHIP_LIMITS_PENDING','113'],
    ['HORSE.OWNERSHIP_LIMITS_NONE','114'],['HORSE.OWNERSHIP_LIMITS','115'],
    -- 3.3 Lessor's Disclosures — Human Injury
    ['HORSE.INJURIES_TO_HUMANS_GATE','120'],['HORSE.INJURIES_TO_HUMANS_NONE','121'],
    ['HORSE.INJURIES_TO_HUMANS_DISCLOSED','122'],['HORSE.INJURIES_TO_HUMANS_UNKNOWN','123'],
    ['HORSE.INJURIES_TO_HUMANS_DISCLOSED_ACK','124'],
    -- Behavior
    ['HORSE.BEHAVIORAL_HISTORY_GATE','130'],['HORSE.BEHAVIORAL_HISTORY_NONE','131'],
    ['HORSE.BEHAVIORAL_HISTORY_DISCLOSED','132'],['HORSE.BEHAVIORAL_HISTORY_DISCLOSED_ACK','133'],
    -- Horse Injury
    ['HORSE.INJURIES_TO_HORSE_GATE','140'],['HORSE.INJURIES_TO_HORSE_NONE','141'],
    ['HORSE.INJURIES_TO_HORSE_DISCLOSED','142'],['HORSE.INJURIES_TO_HORSE_DISCLOSED_ACK','143'],
    -- Known Conditions
    ['HORSE.KNOWN_CONDITIONS_GATE','150'],['HORSE.KNOWN_CONDITIONS_NONE','151'],
    ['HORSE.KNOWN_CONDITIONS_DISCLOSED','152'],['HORSE.KNOWN_CONDITIONS_DISCLOSED_ACK','153'],
    -- Medical History
    ['HORSE.MEDICAL_HISTORY_GATE','160'],['HORSE.MEDICAL_HISTORY_NONE','161'],
    ['HORSE.MEDICAL_HISTORY_DISCLOSED','162'],['HORSE.MEDICAL_HISTORY_DISCLOSED_ACK','163'],
    -- Medications
    ['HORSE.MEDICATIONS_GATE','170'],['HORSE.MEDICATIONS_NONE','171'],
    ['HORSE.MEDICATIONS_DISCLOSED','172'],['HORSE.MEDICATIONS_DISCLOSED_ACK','173'],
    -- Supplements
    ['HORSE.SUPPLEMENTS_GATE','180'],['HORSE.SUPPLEMENTS_NONE','181'],
    ['HORSE.SUPPLEMENTS_DISCLOSED','182'],['HORSE.SUPPLEMENTS_DISCLOSED_ACK','183'],
    -- 3.4 Condition and Behavior warranties (+ variants)
    ['HORSE.BEHAVIOR_PLAIN','190'],['HORSE.BEHAVIOR_EXC','191'],
    ['HORSE.CONDITION_PLAIN','192'],['HORSE.CONDITION_EXC','193'],
    -- 3.5 Disclaimer of Warranties
    ['HORSE.WARRANTY','200'],
    -- Pre-Lease Examination / Evaluation (vet + trainer, after the disclaimer)
    ['HORSE.VET_CHECK','210'],['HORSE.VET_CHECK_LESSEE_OWN','211'],['HORSE.VET_CHECK_LESSEE_AT_LESSOR','212'],
    ['HORSE.VET_CHECK_LESSOR_FREE','213'],['HORSE.VET_CHECK_WAIVED','214'],
    ['HORSE.TRAINER_EVAL','220'],['HORSE.TRAINER_EVAL_LESSEE_OWN','221'],['HORSE.TRAINER_EVAL_LESSEE_AT_LESSOR','222'],
    ['HORSE.TRAINER_EVAL_LESSOR_FREE','223'],['HORSE.TRAINER_EVAL_WAIVED','224']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(v,1) LOOP
    UPDATE contract_clause_defs SET sort_order = v[i][2]::int
     WHERE template_key='HORSE_LEASE_V3' AND clause_key = v[i][1];
  END LOOP;
END $seq$;

-- ── Sale HORSE section: put the seven disclosure sections in the Part 1.1 order
--    (Human Injury first), keeping the identity/ownership/warranty wrapping. ──
DO $seqs$
DECLARE
  v text[][] := ARRAY[
    ['HORSE.INJURIES_TO_HUMANS_GATE','120'],['HORSE.INJURIES_TO_HUMANS_NONE','121'],
    ['HORSE.INJURIES_TO_HUMANS_DISCLOSED','122'],['HORSE.INJURIES_TO_HUMANS_UNKNOWN','123'],
    ['HORSE.INJURIES_TO_HUMANS_DISCLOSED_ACK','124'],['HORSE.INJURIES_TO_HUMANS_DISCLOSED_ACK_CB','125'],
    ['HORSE.BEHAVIORAL_HISTORY_GATE','130'],['HORSE.BEHAVIORAL_HISTORY_NONE','131'],
    ['HORSE.BEHAVIORAL_HISTORY_DISCLOSED','132'],['HORSE.BEHAVIORAL_HISTORY_DISCLOSED_ACK','133'],['HORSE.BEHAVIORAL_HISTORY_DISCLOSED_ACK_CB','134'],
    ['HORSE.INJURIES_TO_HORSE_GATE','140'],['HORSE.INJURIES_TO_HORSE_NONE','141'],
    ['HORSE.INJURIES_TO_HORSE_DISCLOSED','142'],['HORSE.INJURIES_TO_HORSE_DISCLOSED_ACK','143'],['HORSE.INJURIES_TO_HORSE_DISCLOSED_ACK_CB','144'],
    ['HORSE.KNOWN_CONDITIONS_GATE','150'],['HORSE.KNOWN_CONDITIONS_NONE','151'],
    ['HORSE.KNOWN_CONDITIONS_DISCLOSED','152'],['HORSE.KNOWN_CONDITIONS_DISCLOSED_ACK','153'],['HORSE.KNOWN_CONDITIONS_DISCLOSED_ACK_CB','154'],
    ['HORSE.MEDICAL_HISTORY_GATE','160'],['HORSE.MEDICAL_HISTORY_NONE','161'],
    ['HORSE.MEDICAL_HISTORY_DISCLOSED','162'],['HORSE.MEDICAL_HISTORY_DISCLOSED_ACK','163'],['HORSE.MEDICAL_HISTORY_DISCLOSED_ACK_CB','164'],
    ['HORSE.MEDICATIONS_GATE','170'],['HORSE.MEDICATIONS_NONE','171'],
    ['HORSE.MEDICATIONS_DISCLOSED','172'],['HORSE.MEDICATIONS_DISCLOSED_ACK','173'],['HORSE.MEDICATIONS_DISCLOSED_ACK_CB','174'],
    ['HORSE.SUPPLEMENTS_GATE','180'],['HORSE.SUPPLEMENTS_NONE','181'],
    ['HORSE.SUPPLEMENTS_DISCLOSED','182'],['HORSE.SUPPLEMENTS_DISCLOSED_ACK','183'],['HORSE.SUPPLEMENTS_DISCLOSED_ACK_CB','184']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(v,1) LOOP
    UPDATE contract_clause_defs SET sort_order = v[i][2]::int
     WHERE template_key='HORSE_SALE_V3' AND clause_key = v[i][1];
  END LOOP;
END $seqs$;

-- ── BOS disclosures: same Part 1.1 order (Human Injury first). ──
DO $seqb$
DECLARE
  v text[][] := ARRAY[
    ['BOS_INJURIES_TO_HUMANS_GATE','120'],['BOS_INJURIES_TO_HUMANS_NONE','121'],
    ['BOS_INJURIES_TO_HUMANS_DISCLOSED','122'],['BOS_INJURIES_TO_HUMANS_UNKNOWN','123'],
    ['BOS_INJURIES_TO_HUMANS_DISCLOSED_ACK','124'],['BOS_INJURIES_TO_HUMANS_DISCLOSED_ACK_CB','125'],
    ['BOS_BEHAVIORAL_HISTORY_GATE','130'],['BOS_BEHAVIORAL_HISTORY_NONE','131'],
    ['BOS_BEHAVIORAL_HISTORY_DISCLOSED','132'],['BOS_BEHAVIORAL_HISTORY_DISCLOSED_ACK','133'],['BOS_BEHAVIORAL_HISTORY_DISCLOSED_ACK_CB','134'],
    ['BOS_INJURIES_TO_HORSE_GATE','140'],['BOS_INJURIES_TO_HORSE_NONE','141'],
    ['BOS_INJURIES_TO_HORSE_DISCLOSED','142'],['BOS_INJURIES_TO_HORSE_DISCLOSED_ACK','143'],['BOS_INJURIES_TO_HORSE_DISCLOSED_ACK_CB','144'],
    ['BOS_KNOWN_CONDITIONS_GATE','150'],['BOS_KNOWN_CONDITIONS_NONE','151'],
    ['BOS_KNOWN_CONDITIONS_DISCLOSED','152'],['BOS_KNOWN_CONDITIONS_DISCLOSED_ACK','153'],['BOS_KNOWN_CONDITIONS_DISCLOSED_ACK_CB','154'],
    ['BOS_MEDICAL_HISTORY_GATE','160'],['BOS_MEDICAL_HISTORY_NONE','161'],
    ['BOS_MEDICAL_HISTORY_DISCLOSED','162'],['BOS_MEDICAL_HISTORY_DISCLOSED_ACK','163'],['BOS_MEDICAL_HISTORY_DISCLOSED_ACK_CB','164'],
    ['BOS_MEDICATIONS_GATE','170'],['BOS_MEDICATIONS_NONE','171'],
    ['BOS_MEDICATIONS_DISCLOSED','172'],['BOS_MEDICATIONS_DISCLOSED_ACK','173'],['BOS_MEDICATIONS_DISCLOSED_ACK_CB','174'],
    ['BOS_SUPPLEMENTS_GATE','180'],['BOS_SUPPLEMENTS_NONE','181'],
    ['BOS_SUPPLEMENTS_DISCLOSED','182'],['BOS_SUPPLEMENTS_DISCLOSED_ACK','183'],['BOS_SUPPLEMENTS_DISCLOSED_ACK_CB','184']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(v,1) LOOP
    UPDATE contract_clause_defs SET sort_order = v[i][2]::int
     WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key = v[i][1];
  END LOOP;
END $seqb$;

-- ── Part 2.3 BOS: the accompanying-sale-agreement selector moves to the top, before
--    anything it gates. Its gate carrier clause gets the lowest sort in its section. ──
UPDATE contract_clause_defs SET sort_order = 1
 WHERE template_key='HORSE_BILL_OF_SALE'
   AND clause_key = (SELECT clause_key FROM contract_field_defs WHERE template_key='HORSE_BILL_OF_SALE' AND field_key='TXN.BOS_HAS_SALE_AGREEMENT');
