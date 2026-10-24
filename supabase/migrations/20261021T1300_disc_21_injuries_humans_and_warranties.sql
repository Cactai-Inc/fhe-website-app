-- Disclosure rebuild, phase 21: injuries-to-humans No/Yes/Unknown clauses, and
-- the lease warranty variants (+ removal of the sale's flat behavior warranty).
--
-- Runs AFTER disc_18 (which deletes the *_DISCLOSED_ADD clauses) and disc_19 (which
-- makes injuries_to_humans a Yes/No/Unknown scalar).

-- ── 0. Fix a pre-existing data bug in the injury NONE clauses ──
-- disc_5/6/7 seeded these bodies inside $j$…$j$ dollar-quotes where "''" is NOT an
-- escape but two literal apostrophes, so "Seller''s / Lessor''s knowledge" is stored
-- and would print doubled on a live contract. Collapse each "''" to "'".
UPDATE contract_clause_defs
   SET body = replace(body, '''''', '''')
 WHERE template_key IN ('HORSE_LEASE_V3','HORSE_SALE_V3','HORSE_BILL_OF_SALE')
   AND body LIKE '%''''%';

-- ── 1. Injuries caused to humans: three clauses driven by the scalar gate ──
-- No  -> the none representation (unchanged).
-- Yes -> the disclosed representation + acknowledgment, NOTHING under it (the record
--        carries no entries for this section; drop the enumeration + token).
-- Unknown -> a representation of no knowledge, mirroring the clause style.
-- Same three on all three documents, in each document's voice and gate wiring.

DO $ith$
DECLARE
  d record;
  v_voice text;         -- Lessor | Seller
  v_other text;         -- Lessee | Buyer
  v_gatecond jsonb;     -- base gate condition minus the YES/NO/UNKNOWN leaf
  v_none_key text; v_disc_key text; v_unk_key text; v_prefix text;
  v_bos boolean;
  v_disc_sort int;
BEGIN
  FOR d IN
    SELECT template_key, clause_key, section_key, sort_order, conditional_on, body
      FROM contract_clause_defs
     WHERE clause_key LIKE '%INJURIES_TO_HUMANS_NONE'
       AND template_key IN ('HORSE_LEASE_V3','HORSE_SALE_V3','HORSE_BILL_OF_SALE')
  LOOP
    v_bos := d.template_key = 'HORSE_BILL_OF_SALE';
    v_prefix := CASE WHEN v_bos THEN 'BOS_' ELSE 'HORSE.' END;
    v_none_key := d.clause_key;
    v_disc_key := replace(d.clause_key, '_NONE', '_DISCLOSED');
    v_unk_key  := replace(d.clause_key, '_NONE', '_UNKNOWN');
    v_voice := CASE WHEN d.template_key='HORSE_LEASE_V3' THEN 'Lessor' ELSE 'Seller' END;
    v_other := CASE WHEN d.template_key='HORSE_LEASE_V3' THEN 'Lessee' ELSE 'Buyer' END;
    SELECT sort_order INTO v_disc_sort FROM contract_clause_defs
      WHERE template_key=d.template_key AND clause_key=v_disc_key;

    -- the gate condition with each possible answer, preserving the BOS standalone AND-leaf.
    -- The gate FIELD is always HORSE.INJURIES_TO_HUMANS_GATE (the imported disclosure
    -- gate field is HORSE.* on every template; v_prefix governs CLAUSE keys, not the
    -- gate field_key — the other six BOS sections likewise gate on HORSE.<SECTION>_GATE).
    IF v_bos THEN
      v_gatecond := jsonb_build_object('all', jsonb_build_array(
        jsonb_build_object('equals', jsonb_build_array('NO'), 'field_key', 'TXN.BOS_HAS_SALE_AGREEMENT'),
        jsonb_build_object('equals', jsonb_build_array('__ANS__'), 'field_key', 'HORSE.INJURIES_TO_HUMANS_GATE')));
    ELSE
      v_gatecond := jsonb_build_object('equals', jsonb_build_array('__ANS__'), 'field_key', 'HORSE.INJURIES_TO_HUMANS_GATE');
    END IF;

    -- NONE: approved final wording (no list of ways a horse can injure a person).
    -- Seller voice on sale/BOS, Lessor on lease. Gate reasserted to the NO answer.
    UPDATE contract_clause_defs
       SET body = v_voice || ' represents that, to ' || v_voice || '''s knowledge, no person has been seriously injured by the direct actions of the Horse. This representation does not extend to any incident caused primarily by a third party or an external stimulus, such as another horse or rider being at fault, a loose dog, wildlife, or a vehicle, where the Horse''s reaction was within the range of normal equine behavior.',
           conditional_on = replace(v_gatecond::text, '__ANS__', 'NO')::jsonb
     WHERE template_key=d.template_key AND clause_key=v_none_key;

    -- DISCLOSED (Yes): approved final wording; NO entries, NO token, and the
    -- acknowledgment sentence is NOT here — it lives on the per-section initials
    -- acknowledgment line (disc_25). The clause states only the disclosure.
    UPDATE contract_clause_defs
       SET body = v_voice || ' discloses that one or more persons have been seriously injured by the direct actions of the Horse.',
           conditional_on = replace(v_gatecond::text, '__ANS__', 'YES')::jsonb
     WHERE template_key=d.template_key AND clause_key=v_disc_key;

    -- UNKNOWN: approved final wording.
    INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
    VALUES (d.template_key, d.section_key, v_unk_key, NULL,
            v_voice || ' has no knowledge of whether any person has been seriously injured by the direct actions of the Horse.',
            'input', coalesce(v_disc_sort,d.sort_order+1) + 1, false,
            replace(v_gatecond::text, '__ANS__', 'UNKNOWN')::jsonb, false)
    ON CONFLICT (template_key, clause_key) DO UPDATE
      SET body = EXCLUDED.body, conditional_on = EXCLUDED.conditional_on;
  END LOOP;
END $ith$;

-- ── 2. Lease warranties: two auto-selected variants each; remove sale's flat one ──
-- Behavior warranty follows the behavioral-concerns gate.
-- Condition warranty follows ANY of known-conditions / medical-history /
-- injuries-to-horse / medications gates (carve-out when any is yes).

-- Sale: remove the flat behavior warranty entirely (AS-IS + the disclosure
-- representations cover it). The AS-IS HORSE.WARRANTY stays.
DELETE FROM contract_field_defs  WHERE template_key='HORSE_SALE_V3' AND clause_key='HORSE.BEHAVIOR';
DELETE FROM contract_clause_defs WHERE template_key='HORSE_SALE_V3' AND clause_key='HORSE.BEHAVIOR';

-- Lease: replace HORSE.BEHAVIOR with _PLAIN / _EXC variants.
DO $lw$
DECLARE v_beh_sort int; v_cond_sort int;
  v_any_yes jsonb := jsonb_build_object('any', jsonb_build_array(
    jsonb_build_object('equals', jsonb_build_array('YES'), 'field_key', 'HORSE.KNOWN_CONDITIONS_GATE'),
    jsonb_build_object('equals', jsonb_build_array('YES'), 'field_key', 'HORSE.MEDICAL_HISTORY_GATE'),
    jsonb_build_object('equals', jsonb_build_array('YES'), 'field_key', 'HORSE.INJURIES_TO_HORSE_GATE'),
    jsonb_build_object('equals', jsonb_build_array('YES'), 'field_key', 'HORSE.MEDICATIONS_GATE')));
  v_all_no jsonb := jsonb_build_object('all', jsonb_build_array(
    jsonb_build_object('equals', jsonb_build_array('NO'), 'field_key', 'HORSE.KNOWN_CONDITIONS_GATE'),
    jsonb_build_object('equals', jsonb_build_array('NO'), 'field_key', 'HORSE.MEDICAL_HISTORY_GATE'),
    jsonb_build_object('equals', jsonb_build_array('NO'), 'field_key', 'HORSE.INJURIES_TO_HORSE_GATE'),
    jsonb_build_object('equals', jsonb_build_array('NO'), 'field_key', 'HORSE.MEDICATIONS_GATE')));
  v_beh_yes jsonb := jsonb_build_object('equals', jsonb_build_array('YES'), 'field_key', 'HORSE.BEHAVIORAL_HISTORY_GATE');
  v_beh_no  jsonb := jsonb_build_object('equals', jsonb_build_array('NO'),  'field_key', 'HORSE.BEHAVIORAL_HISTORY_GATE');
  v_exc text := ', except as disclosed in the Horse section of this Agreement';
BEGIN
  SELECT sort_order INTO v_beh_sort  FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.BEHAVIOR';
  SELECT sort_order INTO v_cond_sort FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.CONDITION';

  DELETE FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V3' AND clause_key IN ('HORSE.BEHAVIOR','HORSE.CONDITION');

  INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem) VALUES
    ('HORSE_LEASE_V3','HORSE','HORSE.BEHAVIOR_PLAIN', NULL,
     'The Lessor warrants that the Horse has no history of dangerous or vicious behavior as of the Effective Date of this Agreement.',
     'input', v_beh_sort, false, v_beh_no, false),
    ('HORSE_LEASE_V3','HORSE','HORSE.BEHAVIOR_EXC', NULL,
     'The Lessor warrants that the Horse has no history of dangerous or vicious behavior as of the Effective Date of this Agreement' || v_exc || '.',
     'input', v_beh_sort, false, v_beh_yes, false),
    ('HORSE_LEASE_V3','HORSE','HORSE.CONDITION_PLAIN', NULL,
     'The Lessor warrants that the Horse is sound and in good physical condition as of the Effective Date of this Agreement.',
     'input', v_cond_sort, false, v_all_no, false),
    ('HORSE_LEASE_V3','HORSE','HORSE.CONDITION_EXC', NULL,
     'The Lessor warrants that the Horse is sound and in good physical condition as of the Effective Date of this Agreement' || v_exc || '.',
     'input', v_cond_sort, false, v_any_yes, false);
END $lw$;
