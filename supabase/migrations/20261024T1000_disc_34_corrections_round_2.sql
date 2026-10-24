-- Phase 34: corrections round 2 — the nine items the owner raised after reviewing
-- the manifests. Each is applied exactly as written; nothing moves except where an
-- item says so. Runs after disc_18–33.
--
--  1. Lease §3: Location moves after the Disclaimer; nothing in §3 prints before Horse Details.
--  2. Lease Horse Details: add Barn Name and Height.
--  3. Sale §3 order: Horse, Title & Ownership (encumbrances), seven disclosures, Breeding, Disclaimer.
--  4. BOS: sale-agreement selector to the top; when a sale agreement accompanies, the BOS
--     PPE statement derives from the sale's PPE election and prints locked (does not vanish).
--  5. Every pending placeholder inherits its field's own show-condition in addition to the blank test.
--  6. Required-with-pending inside their branch: vet & trainer timing (requested option),
--     vet days & end date (Lessor provided), sublease conditions (conditional),
--     evaluation period type (requested or required).
--  7. Remove the HORSE.INJURIES_TO_HUMANS content field (all 3); rename the behavior content
--     field label to "Behavior disclosure"; human-injury gate options Yes/No/Unknown.
--  8. Lease Condition/Behavior warranties get the heading "Condition and Behavior".
--  9. Attach the four orphan sale fields to the clauses that print them.


-- ════════════════════════════════════════════════════════════════════════════
-- ITEM 1 — LEASE §3: Location after the Disclaimer; nothing before Horse Details.
-- Horse Details (HORSE.IDENTITY) is sort 100. Location is currently 56–59, printing
-- before it. The Disclaimer is HORSE.WARRANTY (sort 200); the Pre-Lease Exam (vet/
-- trainer) follows at 210–224. Move the four LOCATION clauses to 201–204, between the
-- Disclaimer (200) and the Pre-Lease Exam (210), preserving their internal order.
-- ════════════════════════════════════════════════════════════════════════════
UPDATE contract_clause_defs SET sort_order = 201 WHERE template_key='HORSE_LEASE_V3' AND clause_key='LOCATION.MAIN';
UPDATE contract_clause_defs SET sort_order = 202 WHERE template_key='HORSE_LEASE_V3' AND clause_key='LOCATION.MOVE_CHOICE';
UPDATE contract_clause_defs SET sort_order = 203 WHERE template_key='HORSE_LEASE_V3' AND clause_key='LOCATION.NEW';
UPDATE contract_clause_defs SET sort_order = 204 WHERE template_key='HORSE_LEASE_V3' AND clause_key='LOCATION.INSPECTION';


-- ════════════════════════════════════════════════════════════════════════════
-- ITEM 2 — LEASE Horse Details: add Barn Name and Height.
-- They sit on the HORSE.IDENTITY clause. Barn Name after Registered name (10) → 12;
-- Height after Breed (30) → 32. Both imported from the horse record (HORSE.* tokens).
-- The clause body prints a labeled list, so add the two tokens into HORSE.IDENTITY body.
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO contract_field_defs (template_key, field_key, label, section, clause_key, owner_role, input_kind, value_type, format_type, required, is_optional, sort_order, guidance)
VALUES
  ('HORSE_LEASE_V3','HORSE.BARN_NAME','Barn name','HORSE','HORSE.IDENTITY','SYSTEM','text','text','text', false, true, 12,
   'Imported from the horse''s record. Changes to this information must be made on the horse''s record on the Horses page.'),
  ('HORSE_LEASE_V3','HORSE.HEIGHT','Height','HORSE','HORSE.IDENTITY','SYSTEM','text','text','text', false, true, 32,
   'Imported from the horse''s record. Changes to this information must be made on the horse''s record on the Horses page.')
ON CONFLICT (template_key, field_key) DO UPDATE SET label=EXCLUDED.label, clause_key=EXCLUDED.clause_key, sort_order=EXCLUDED.sort_order, guidance=EXCLUDED.guidance;

-- Add the two tokens to the printed identity list. The intro line ends with
-- {{HORSE.REGISTERED_NAME}}; Barn name follows it. "Breed: …" is its own line; Height
-- follows it. Match the exact token/label text present in the body.
UPDATE contract_clause_defs
   SET body = replace(body, '{{HORSE.REGISTERED_NAME}}', '{{HORSE.REGISTERED_NAME}}' || E'\nBarn name: {{HORSE.BARN_NAME}}')
 WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.IDENTITY' AND body NOT LIKE '%HORSE.BARN_NAME%';
UPDATE contract_clause_defs
   SET body = replace(body, 'Breed: {{HORSE.BREED}}', 'Breed: {{HORSE.BREED}}' || E'\nHeight: {{HORSE.HEIGHT}}')
 WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.IDENTITY' AND body NOT LIKE '%HORSE.HEIGHT%';


-- ════════════════════════════════════════════════════════════════════════════
-- ITEM 3 — SALE §3 order: Horse, Title & Ownership (encumbrances), seven disclosures,
-- Breeding, Disclaimer. Currently: Identity(10), Ownership/encumbrances(20–30),
-- Breeding(84–100), Disclaimer=WARRANTY(110), disclosures(120–184).
-- Move Breeding and the Disclaimer to AFTER the disclosures. Disclosures end at 184.
--   Breeding: 84→190(pending), 85→191(gate), 90→192, 100→193
--   Disclaimer (WARRANTY): 110→200
-- ════════════════════════════════════════════════════════════════════════════
UPDATE contract_clause_defs SET sort_order = 190 WHERE template_key='HORSE_SALE_V3' AND clause_key='BREEDING_ELECTION_PENDING';
UPDATE contract_clause_defs SET sort_order = 191 WHERE template_key='HORSE_SALE_V3' AND clause_key='HORSE.BREEDING_GATE';
UPDATE contract_clause_defs SET sort_order = 192 WHERE template_key='HORSE_SALE_V3' AND clause_key='HORSE.BREEDING';
UPDATE contract_clause_defs SET sort_order = 193 WHERE template_key='HORSE_SALE_V3' AND clause_key='HORSE.BREEDING_DECLINED';
UPDATE contract_clause_defs SET sort_order = 200 WHERE template_key='HORSE_SALE_V3' AND clause_key='HORSE.WARRANTY';


-- ════════════════════════════════════════════════════════════════════════════
-- ITEM 7 — human-injury content field removed; behavior content label renamed;
-- human-injury gate options Yes/No/Unknown. (Done before items 4/5/6 so the
-- condition rewrites in 5/6 see the final field set.)
-- ════════════════════════════════════════════════════════════════════════════
-- 7a. Remove the HORSE.INJURIES_TO_HUMANS content field on all three templates.
--     The human-injury disclosure is a scalar Yes/No/Unknown on the gate; there is
--     no free-text content entry. The DISCLOSED clause already carries no token.
DELETE FROM contract_field_defs WHERE field_key='HORSE.INJURIES_TO_HUMANS'
  AND template_key IN ('HORSE_LEASE_V3','HORSE_SALE_V3','HORSE_BILL_OF_SALE');

-- 7b. Rename the behavior content field label to "Behavior disclosure" on all three.
UPDATE contract_field_defs SET label='Behavior disclosure'
 WHERE field_key='HORSE.BEHAVIORAL_HISTORY'
   AND template_key IN ('HORSE_LEASE_V3','HORSE_SALE_V3','HORSE_BILL_OF_SALE');

-- 7c. Human-injury gate options: add Unknown (was Yes/No) on all three.
UPDATE contract_field_defs
   SET options = '[{"label": "Yes", "value": "YES"}, {"label": "No", "value": "NO"}, {"label": "Unknown", "value": "UNKNOWN"}]'::jsonb
 WHERE field_key='HORSE.INJURIES_TO_HUMANS_GATE'
   AND template_key IN ('HORSE_LEASE_V3','HORSE_SALE_V3','HORSE_BILL_OF_SALE');


-- ════════════════════════════════════════════════════════════════════════════
-- ITEM 8 — Lease warranties get the heading "Condition and Behavior", printed ONCE.
-- The group is two independent, mutually-exclusive pairs: Behavior (190/191, one shows
-- on BEHAVIORAL_HISTORY_GATE) then Condition (192/193, one shows on the four condition
-- gates). Exactly one of each pair prints, so two clauses render and the Behavior one
-- is first. The composer gives each HEADED clause its own number, and folds a
-- render_as_subitem continuation under the item above. So: put the heading on BOTH
-- behavior variants (only one ever shows → heading appears exactly once) and make BOTH
-- condition variants headingless continuations (render_as_subitem) that fold beneath it.
-- Result: one numbered "Condition and Behavior" item with the behavior sentence and the
-- condition sentence under it.
-- ════════════════════════════════════════════════════════════════════════════
UPDATE contract_clause_defs SET heading='Condition and Behavior', render_as_subitem=false
 WHERE template_key='HORSE_LEASE_V3' AND clause_key IN ('HORSE.BEHAVIOR_PLAIN','HORSE.BEHAVIOR_EXC');
UPDATE contract_clause_defs SET heading=NULL, render_as_subitem=true
 WHERE template_key='HORSE_LEASE_V3' AND clause_key IN ('HORSE.CONDITION_PLAIN','HORSE.CONDITION_EXC');


-- ════════════════════════════════════════════════════════════════════════════
-- ITEM 9 — attach the orphan sale fields (clause_key NULL) to the clauses that print
-- them. The editor skips any field with no clause_key, so these never render. Verified
-- homes (a field renders inline where its {{TOKEN}} sits in a clause body, or as a
-- control on the clause it is homed on):
--   TXN.BOARD_RATE_AFTER     → DELIVERY.DELAYS      (its token prints there)
--   TXN.SELLER_DELAY_PENALTY → DELIVERY.DELAYS      (its token prints there)
--   TXN.TRIAL_BOARD_COST     → TRIAL.TERMS          (its token prints there and in TRIAL.TERMS_CURRENT)
--   TXN.TRANSPORT_APPLIES    → DELIVERY.TRANSPORT   (the gate that shows that clause and its
--                                                    two sub-fields; it had no home and no options)
-- TXN.TRANSPORT_APPLIES additionally lacked Yes/No options, so a user could never set
-- the gate that reveals Transport — fixed here so the control actually functions.
--
-- NOTE / FLAG (not silently changed): TXN.TRANSPORT_NEEDED is gated on the retirement
-- sentinel {"equals":["__RETIRED__"],"field_key":"TXN.DELIVERY_LOCATION"}, is referenced
-- by zero clause bodies and zero gates, and never shows. It is a RETIRED field, not a
-- live orphan; attaching it to a clause cannot make it render. Left untouched and
-- reported rather than wired to a clause it does not print in.
-- ════════════════════════════════════════════════════════════════════════════
UPDATE contract_field_defs SET clause_key='DELIVERY.DELAYS'
 WHERE template_key='HORSE_SALE_V3' AND field_key='TXN.BOARD_RATE_AFTER' AND clause_key IS NULL;
UPDATE contract_field_defs SET clause_key='DELIVERY.DELAYS'
 WHERE template_key='HORSE_SALE_V3' AND field_key='TXN.SELLER_DELAY_PENALTY' AND clause_key IS NULL;
UPDATE contract_field_defs SET clause_key='TRIAL.TERMS'
 WHERE template_key='HORSE_SALE_V3' AND field_key='TXN.TRIAL_BOARD_COST' AND clause_key IS NULL;
-- TXN.TRANSPORT_APPLIES is SYSTEM-COMPUTED, never author-selected (owner, corrections
-- round 2, task 3): recompose_document_fields sets it YES when the delivery location
-- differs from the handoff origin (trial location if a trial is elected, else the
-- horse's current location). Home it on DELIVERY.TRANSPORT for DISPLAY ONLY — it keeps
-- owner_role SYSTEM and carries NO options (it is not a control). The round-1 Yes/No
-- options are removed here.
UPDATE contract_field_defs
   SET clause_key='DELIVERY.TRANSPORT', owner_role='SYSTEM', input_kind='text', options=NULL
 WHERE template_key='HORSE_SALE_V3' AND field_key='TXN.TRANSPORT_APPLIES';


-- ════════════════════════════════════════════════════════════════════════════
-- ITEM 6 — four selectors become required, each with a pending placeholder that
-- shows INSIDE its branch (the field's own show-condition AND the blank test).
-- Done before item 5 so item 5's pass sees these new pendings and their conditions.
--   (a) vet timing (TXN.VET_TIMING)   — applies when a vet option is requested,
--       i.e. TXN.VET_CHECK_CHOICE in (LESSEE_OWN, LESSEE_AT_LESSOR, LESSOR_FREE).
--   (b) trainer timing (TXN.TRAINER_TIMING) — same, on TXN.TRAINER_EVAL_CHOICE.
--   (c) vet days + end date (TXN.VET_DAYS, TXN.VET_END_DATE) — Lessor provided,
--       i.e. TXN.VET_CHECK_CHOICE = LESSOR_FREE.
--   (d) sublease conditions (TXN.SUBLEASE_CONDITIONS) — FULL lease AND CONDITIONAL.
--   (e) evaluation period type (TXN.EVAL_PERIOD_TYPE) — EVALUATION_ENABLED in
--       (REQUESTED, REQUIRED).
-- ════════════════════════════════════════════════════════════════════════════
DO $it6$
DECLARE
  v_vet_requested  jsonb := jsonb_build_object('any', jsonb_build_array(
     jsonb_build_object('equals', jsonb_build_array('LESSEE_OWN'),       'field_key','TXN.VET_CHECK_CHOICE'),
     jsonb_build_object('equals', jsonb_build_array('LESSEE_AT_LESSOR'), 'field_key','TXN.VET_CHECK_CHOICE'),
     jsonb_build_object('equals', jsonb_build_array('LESSOR_FREE'),      'field_key','TXN.VET_CHECK_CHOICE')));
  v_trn_requested  jsonb := jsonb_build_object('any', jsonb_build_array(
     jsonb_build_object('equals', jsonb_build_array('LESSEE_OWN'),       'field_key','TXN.TRAINER_EVAL_CHOICE'),
     jsonb_build_object('equals', jsonb_build_array('LESSEE_AT_LESSOR'), 'field_key','TXN.TRAINER_EVAL_CHOICE'),
     jsonb_build_object('equals', jsonb_build_array('LESSOR_FREE'),      'field_key','TXN.TRAINER_EVAL_CHOICE')));
  v_vet_lessor     jsonb := jsonb_build_object('equals', jsonb_build_array('LESSOR_FREE'), 'field_key','TXN.VET_CHECK_CHOICE');
  v_sub_cond       jsonb := jsonb_build_object('all', jsonb_build_array(
     jsonb_build_object('equals', jsonb_build_array('FULL'),        'field_key','TXN.LEASE_TYPE'),
     jsonb_build_object('equals', jsonb_build_array('CONDITIONAL'), 'field_key','TXN.SUBLEASE')));
  v_eval_rr        jsonb := jsonb_build_object('equals', jsonb_build_array('REQUESTED','REQUIRED'), 'field_key','TXN.EVALUATION_ENABLED');
  v_blank          jsonb;
  r record;
BEGIN
  -- set show-condition + required on the five fields
  UPDATE contract_field_defs SET required=true, conditional_on=v_vet_requested WHERE template_key='HORSE_LEASE_V3' AND field_key='TXN.VET_TIMING';
  UPDATE contract_field_defs SET required=true, conditional_on=v_trn_requested WHERE template_key='HORSE_LEASE_V3' AND field_key='TXN.TRAINER_TIMING';
  UPDATE contract_field_defs SET required=true, conditional_on=v_vet_lessor    WHERE template_key='HORSE_LEASE_V3' AND field_key='TXN.VET_DAYS';
  UPDATE contract_field_defs SET required=true, conditional_on=v_vet_lessor    WHERE template_key='HORSE_LEASE_V3' AND field_key='TXN.VET_END_DATE';
  UPDATE contract_field_defs SET required=true                                 WHERE template_key='HORSE_LEASE_V3' AND field_key='TXN.SUBLEASE_CONDITIONS'; -- condition already FULL+CONDITIONAL
  UPDATE contract_field_defs SET required=true, conditional_on=v_eval_rr       WHERE template_key='HORSE_LEASE_V3' AND field_key='TXN.EVAL_PERIOD_TYPE';

  -- a pending placeholder for each, gated on (field show-condition AND field is blank),
  -- placed just inside the branch. Subject text names the specific selection.
  FOR r IN
    SELECT * FROM (VALUES
      ('TXN.VET_TIMING',          v_vet_requested, 'when the pre-lease veterinary examination takes place', 215),
      ('TXN.TRAINER_TIMING',      v_trn_requested, 'when the pre-lease trainer evaluation takes place',      225),
      ('TXN.VET_DAYS',            v_vet_lessor,    'how many days before the Agreement the Lessor-provided examination occurs', 216),
      ('TXN.VET_END_DATE',        v_vet_lessor,    'the date by which the Lessor-provided examination results are delivered',   217),
      ('TXN.SUBLEASE_CONDITIONS', v_sub_cond,      'the conditions on which subleasing is permitted',       26),
      ('TXN.EVAL_PERIOD_TYPE',    v_eval_rr,       'the evaluation period arrangement',                     8)
    ) AS t(fk, showcond, subject, srt)
  LOOP
    v_blank := jsonb_build_object('equals', jsonb_build_array(''), 'field_key', r.fk);
    INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
    SELECT 'HORSE_LEASE_V3', fd.section, replace(r.fk,'TXN.','')||'_PENDING', NULL,
           '[Pending — select '||r.subject||'. This placeholder is replaced by the applicable term and blocks signing.]',
           'input', r.srt, false,
           jsonb_build_object('all', jsonb_build_array(r.showcond, v_blank)), false
      FROM contract_field_defs fd WHERE fd.template_key='HORSE_LEASE_V3' AND fd.field_key=r.fk LIMIT 1
    ON CONFLICT (template_key, clause_key) DO UPDATE
      SET conditional_on=EXCLUDED.conditional_on, body=EXCLUDED.body, sort_order=EXCLUDED.sort_order;
  END LOOP;
END $it6$;


-- ════════════════════════════════════════════════════════════════════════════
-- ITEM 5 — every pending placeholder inherits its field's own show-condition in
-- addition to the blank test, so a placeholder never prints for a field that does
-- not apply. Data-driven pass over all three templates: for each *_PENDING clause,
-- find the selector field it tests for blank; if that field has its own
-- conditional_on, rewrite the pending's condition to AND(field.conditional_on, blank).
-- Pendings whose field has no show-condition are left as the plain blank test.
-- Idempotent: re-running yields the same normalized AND.
-- ════════════════════════════════════════════════════════════════════════════
DO $it5$
DECLARE r record; v_sel text; v_show jsonb; v_blank jsonb;
BEGIN
  FOR r IN
    SELECT template_key, clause_key, conditional_on
      FROM contract_clause_defs
     WHERE template_key IN ('HORSE_LEASE_V3','HORSE_SALE_V3','HORSE_BILL_OF_SALE')
       AND clause_key LIKE '%PENDING%'
  LOOP
    -- the field tested for blank (equals ['']) anywhere in this pending's condition
    SELECT x.cond->>'field_key' INTO v_sel
      FROM LATERAL (
        SELECT r.conditional_on AS cond
        UNION ALL SELECT jsonb_array_elements(r.conditional_on->'all')
        UNION ALL SELECT jsonb_array_elements(r.conditional_on->'any')) x
     WHERE x.cond->'equals' ? '' LIMIT 1;
    CONTINUE WHEN v_sel IS NULL;

    SELECT conditional_on INTO v_show FROM contract_field_defs
      WHERE template_key=r.template_key AND field_key=v_sel;
    CONTINUE WHEN v_show IS NULL;   -- field always applies: plain blank test is correct

    v_blank := jsonb_build_object('equals', jsonb_build_array(''), 'field_key', v_sel);
    -- rebuild as AND(field show-condition, blank). If the field's show-condition is
    -- itself an {all:[...]}, flatten its leaves so we don't nest all-in-all needlessly.
    UPDATE contract_clause_defs
       SET conditional_on = jsonb_build_object('all',
             CASE WHEN v_show ? 'all'
                  THEN (v_show->'all') || jsonb_build_array(v_blank)
                  ELSE jsonb_build_array(v_show, v_blank) END)
     WHERE template_key=r.template_key AND clause_key=r.clause_key;
  END LOOP;
END $it5$;


-- ════════════════════════════════════════════════════════════════════════════
-- ITEM 4 — BOS: (a) the sale-agreement selector moves to the TOP of the document;
-- (b) when a sale agreement accompanies, the PPE statement derives from the sale's
-- PPE election and prints LOCKED instead of disappearing.
-- ════════════════════════════════════════════════════════════════════════════

-- 4a. A top-of-document carrier clause in BOS_TITLE, before the intro (sort 5), holds
-- TXN.BOS_HAS_SALE_AGREEMENT. Move the field off BOS_WARRANTY.CONDITION_XREF onto it.
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
VALUES ('HORSE_BILL_OF_SALE','BOS_TITLE','BOS_SALE_AGREEMENT_GATE', NULL, '', 'input', 5, false, NULL, false)
ON CONFLICT (template_key, clause_key) DO NOTHING;
UPDATE contract_field_defs SET clause_key='BOS_SALE_AGREEMENT_GATE', section='BOS_TITLE', sort_order=1
 WHERE template_key='HORSE_BILL_OF_SALE' AND field_key='TXN.BOS_HAS_SALE_AGREEMENT';

-- 4b-i. The PPE statement + ack clauses print on the TXN.BOS_PPE value ALONE (standalone
-- author-selected OR accompanied derived), so a value in either case shows the statement
-- rather than hiding it. Drop the "BOS_HAS_SALE_AGREEMENT = NO" leaf from each.
DO $bospe$
DECLARE r record; v_val text;
BEGIN
  FOR r IN SELECT clause_key FROM contract_clause_defs
            WHERE template_key='HORSE_BILL_OF_SALE'
              AND clause_key LIKE 'BOS_PPE_%' AND clause_key <> 'BOS_PPE_GATE' AND clause_key <> 'BOS_PPE_PENDING'
  LOOP
    v_val := CASE
      WHEN r.clause_key LIKE 'BOS_PPE_SELLER_DECLINED%' THEN 'SELLER_DECLINED'
      WHEN r.clause_key LIKE 'BOS_PPE_BUYER_DECLINED%'  THEN 'BUYER_DECLINED'
      WHEN r.clause_key LIKE 'BOS_PPE_PERFORMED%'       THEN 'PERFORMED' END;
    UPDATE contract_clause_defs
       SET conditional_on = jsonb_build_object('equals', jsonb_build_array(v_val), 'field_key','TXN.BOS_PPE')
     WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key=r.clause_key;
  END LOOP;
END $bospe$;

-- 4b-ii. The derive is NOT uniform, and NO outcome is ever inferred (owner, corrections
-- round 2, task 2 — "the signed document must state which occurred"):
--   sale Seller Declines  → BOS_PPE = SELLER_DECLINED, LOCKED (derived; no author choice)
--   sale Buyer Waived     → BOS_PPE = BUYER_DECLINED,   LOCKED (derived; no author choice)
--   sale Buyer Requested  → NOT derived. BOS_PPE stays blank and the author must state
--                           whether the exam was Performed or the Buyer Declined; a
--                           pending placeholder blocks signing until answered.
-- A SYSTEM marker TXN.BOS_PPE_SOURCE records which case applies so the control and the
-- pending can gate on it: 'DERIVED' (locked, no control), 'AUTHOR' (editable, limited to
-- PERFORMED/BUYER_DECLINED), '' (standalone — author-answered as before).
INSERT INTO contract_field_defs (template_key, field_key, label, section, clause_key, owner_role, input_kind, value_type, format_type, required, is_optional, sort_order, guidance)
VALUES ('HORSE_BILL_OF_SALE','TXN.BOS_PPE_SOURCE','PPE source','BOS_DISCLOSURES','BOS_PPE_GATE','SYSTEM','text','text','text', false, true, 0,
        'System-computed. DERIVED = taken from the accompanying sale and locked; AUTHOR = the sale left the examination outcome open and it must be stated here.')
ON CONFLICT (template_key, field_key) DO NOTHING;

-- The editable selector shows when standalone (no accompanying sale) OR when the sale
-- left it open (SOURCE = AUTHOR). When SOURCE = DERIVED there is no control (= locked).
UPDATE contract_field_defs
   SET conditional_on = '{"any": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["AUTHOR"], "field_key": "TXN.BOS_PPE_SOURCE"}]}'::jsonb
 WHERE template_key='HORSE_BILL_OF_SALE' AND field_key='TXN.BOS_PPE';
-- The empty GATE carrier clause (holds the control) matches that condition.
UPDATE contract_clause_defs
   SET conditional_on = '{"any": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["AUTHOR"], "field_key": "TXN.BOS_PPE_SOURCE"}]}'::jsonb
 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_PPE_GATE';
-- The PENDING blocks signing whenever the selector is answerable but still blank:
-- (standalone OR author) AND BOS_PPE = ''.
UPDATE contract_clause_defs
   SET conditional_on = '{"all": [{"any": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["AUTHOR"], "field_key": "TXN.BOS_PPE_SOURCE"}]}, {"equals": [""], "field_key": "TXN.BOS_PPE"}]}'::jsonb
 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_PPE_PENDING';

-- 4b-iii. Wire the non-uniform derive into start_bill_of_sale (read body, insert before
-- the final party fill). Sets BOS_PPE + BOS_PPE_SOURCE; for the Buyer-Requested case it
-- narrows the per-document options to Performed / Buyer Declined so the author cannot
-- re-open Seller-declined on an accompanied sale.
DO $wire$
DECLARE v_src text; v_new text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src FROM pg_proc WHERE proname='start_bill_of_sale';
  IF v_src IS NULL THEN RAISE EXCEPTION 'start_bill_of_sale not found'; END IF;
  IF position('TXN.BOS_PPE_SOURCE' in v_src) > 0 THEN
    RAISE NOTICE 'start_bill_of_sale already derives TXN.BOS_PPE_SOURCE; leaving as is';
  ELSE
    v_new := replace(v_src,
      '  PERFORM fill_party_fields_from_contacts(v_doc);',
$ins$  -- BOS PPE from the sale's pre-purchase-examination election (owner, corrections
  -- round 2, task 2). Seller-declined and Buyer-waived derive to a locked statement;
  -- Buyer-requested is NOT inferred — the author states Performed or Buyer-Declined,
  -- blocked by a pending until answered. No outcome is ever guessed.
  DECLARE v_ppe_choice text;
  BEGIN
    SELECT coalesce(btrim(value),'') INTO v_ppe_choice FROM contract_fields
      WHERE document_id = p_sale_document_id AND field_key = 'TXN.PPE_CHOICE';
    IF v_ppe_choice = 'SELLER_DECLINES' THEN
      UPDATE contract_fields SET value='SELLER_DECLINED' WHERE document_id=v_doc AND field_key='TXN.BOS_PPE';
      UPDATE contract_fields SET value='DERIVED'         WHERE document_id=v_doc AND field_key='TXN.BOS_PPE_SOURCE';
    ELSIF v_ppe_choice = 'BUYER_WAIVED' THEN
      UPDATE contract_fields SET value='BUYER_DECLINED'  WHERE document_id=v_doc AND field_key='TXN.BOS_PPE';
      UPDATE contract_fields SET value='DERIVED'         WHERE document_id=v_doc AND field_key='TXN.BOS_PPE_SOURCE';
    ELSIF v_ppe_choice = 'BUYER_REQUESTED' THEN
      UPDATE contract_fields SET value=''                WHERE document_id=v_doc AND field_key='TXN.BOS_PPE';
      UPDATE contract_fields SET value='AUTHOR'          WHERE document_id=v_doc AND field_key='TXN.BOS_PPE_SOURCE';
      UPDATE contract_fields
         SET options='[{"label": "An examination was performed and its results were acceptable to the Buyer", "value": "PERFORMED"}, {"label": "Buyer was permitted one and declined to have one performed", "value": "BUYER_DECLINED"}]'::jsonb
       WHERE document_id=v_doc AND field_key='TXN.BOS_PPE';
    END IF;
  END;

  PERFORM fill_party_fields_from_contacts(v_doc);$ins$);
    IF v_new = v_src THEN RAISE EXCEPTION 'start_bill_of_sale: derive anchor not found'; END IF;
    EXECUTE v_new;
  END IF;
END $wire$;


-- ════════════════════════════════════════════════════════════════════════════
-- CORRECTIONS ROUND 3
-- ════════════════════════════════════════════════════════════════════════════

-- ─── R3 TASK 1: transport chain (delivery leg + trial leg) ───────────────────
-- TXN.TRANSPORT_APPLIES stays SYSTEM-computed (recompose: delivery location differs
-- from the handoff origin) and now gates ONLY whether the TRANSPORT_NEEDED question
-- is shown. TXN.TRANSPORT_NEEDED is a live DEAL selector, required, Yes/No, with a
-- pending inside its branch:
--   No  → one line: "Transport of the Horse to the delivery location is the Buyer's
--         responsibility."
--   Yes → the existing arranged-by / paid-by clause, and only then are
--         TXN.TRANSPORT_RESPONSIBLE + TXN.TRANSPORT_COST_RESPONSIBLE shown + required.

-- 1a. TRANSPORT_NEEDED: drop the retirement sentinel; show when TRANSPORT_APPLIES = YES.
UPDATE contract_field_defs
   SET owner_role='DEAL', input_kind='select', required=true, is_optional=false,
       options='[{"label": "Yes", "value": "YES"}, {"label": "No", "value": "NO"}]'::jsonb,
       conditional_on='{"equals": ["YES"], "field_key": "TXN.TRANSPORT_APPLIES"}'::jsonb,
       clause_key='DELIVERY.TRANSPORT_GATE',
       label='Transport to the delivery location arranged by a party?'
 WHERE template_key='HORSE_SALE_V3' AND field_key='TXN.TRANSPORT_NEEDED';

-- 1b. A carrier clause (empty body) holding the TRANSPORT_NEEDED control, shown when
--     TRANSPORT_APPLIES = YES, placed just before the two outcome clauses.
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
VALUES ('HORSE_SALE_V3','DELIVERY','DELIVERY.TRANSPORT_GATE', NULL, '', 'input', 13,
        false, '{"equals": ["YES"], "field_key": "TXN.TRANSPORT_APPLIES"}'::jsonb, false)
ON CONFLICT (template_key, clause_key) DO UPDATE SET conditional_on=EXCLUDED.conditional_on, sort_order=EXCLUDED.sort_order;

-- 1c. Pending inside the branch: TRANSPORT_APPLIES = YES AND TRANSPORT_NEEDED blank.
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
VALUES ('HORSE_SALE_V3','DELIVERY','DELIVERY.TRANSPORT_PENDING', NULL,
        '[Pending — state whether a party arranges transport of the Horse to the delivery location. This placeholder is replaced by the applicable term and blocks signing.]',
        'input', 14, false,
        '{"all": [{"equals": ["YES"], "field_key": "TXN.TRANSPORT_APPLIES"}, {"equals": [""], "field_key": "TXN.TRANSPORT_NEEDED"}]}'::jsonb, false)
ON CONFLICT (template_key, clause_key) DO UPDATE SET body=EXCLUDED.body, conditional_on=EXCLUDED.conditional_on, sort_order=EXCLUDED.sort_order;

-- 1d. No-branch: the one-line Buyer-responsibility statement.
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
VALUES ('HORSE_SALE_V3','DELIVERY','DELIVERY.TRANSPORT_BUYER', NULL,
        'Transport of the Horse to the delivery location is the Buyer''s responsibility.',
        'input', 15, false,
        '{"all": [{"equals": ["YES"], "field_key": "TXN.TRANSPORT_APPLIES"}, {"equals": ["NO"], "field_key": "TXN.TRANSPORT_NEEDED"}]}'::jsonb, false)
ON CONFLICT (template_key, clause_key) DO UPDATE SET body=EXCLUDED.body, conditional_on=EXCLUDED.conditional_on, sort_order=EXCLUDED.sort_order;

-- 1e. Yes-branch: the existing arranged-by/paid-by clause now gates on
--     TRANSPORT_APPLIES = YES AND TRANSPORT_NEEDED = YES.
UPDATE contract_clause_defs
   SET conditional_on='{"all": [{"equals": ["YES"], "field_key": "TXN.TRANSPORT_APPLIES"}, {"equals": ["YES"], "field_key": "TXN.TRANSPORT_NEEDED"}]}'::jsonb,
       sort_order=16
 WHERE template_key='HORSE_SALE_V3' AND clause_key='DELIVERY.TRANSPORT';

-- 1f. The arranged-by/paid-by fields show only on the Yes branch.
UPDATE contract_field_defs
   SET conditional_on='{"all": [{"equals": ["YES"], "field_key": "TXN.TRANSPORT_APPLIES"}, {"equals": ["YES"], "field_key": "TXN.TRANSPORT_NEEDED"}]}'::jsonb
 WHERE template_key='HORSE_SALE_V3' AND field_key IN ('TXN.TRANSPORT_RESPONSIBLE','TXN.TRANSPORT_COST_RESPONSIBLE');

-- ── Trial leg — the same chain. TRIAL_AT_CURRENT (SYSTEM) gates a trial-transport
--    question: when the trial is NOT at the current location, ask whether a party
--    arranges transport to the trial location.
-- Remove the inline trial transport sentence from TRIAL.TERMS (keep everything else),
-- then add the gate carrier, pending, No-line, and the existing sentence as a Yes clause.
UPDATE contract_clause_defs
   SET body = replace(body, E'The Horse shall be transported to the trial location from the Horse''s current location. Transport is arranged by {{TXN.TRIAL_TRANSPORT_RESPONSIBLE}} and paid for by {{TXN.TRIAL_TRANSPORT_COST_RESPONSIBLE}}.\n', '')
 WHERE template_key='HORSE_SALE_V3' AND clause_key='TRIAL.TERMS' AND body LIKE '%transported to the trial location%';

-- new trial-transport selector (DEAL, required), shown when trial on AND not at current
INSERT INTO contract_field_defs (template_key, field_key, label, section, clause_key, owner_role, input_kind, value_type, format_type, required, is_optional, sort_order, options, conditional_on, guidance)
VALUES ('HORSE_SALE_V3','TXN.TRIAL_TRANSPORT_NEEDED','Transport to the trial location arranged by a party?','TRIAL','TRIAL.TRANSPORT_GATE','DEAL','select','text','select', true, false, 0,
        '[{"label": "Yes", "value": "YES"}, {"label": "No", "value": "NO"}]'::jsonb,
        '{"all": [{"equals": ["YES"], "field_key": "TXN.TRIAL_ENABLED"}, {"equals": ["NO"], "field_key": "TXN.TRIAL_AT_CURRENT"}]}'::jsonb,
        'When the trial is held somewhere other than the Horse''s current location, state whether a party arranges transport there.')
ON CONFLICT (template_key, field_key) DO UPDATE SET conditional_on=EXCLUDED.conditional_on, clause_key=EXCLUDED.clause_key, options=EXCLUDED.options, required=EXCLUDED.required;

INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem) VALUES
 ('HORSE_SALE_V3','TRIAL','TRIAL.TRANSPORT_GATE', NULL, '', 'input', 14, false,
   '{"all": [{"equals": ["YES"], "field_key": "TXN.TRIAL_ENABLED"}, {"equals": ["NO"], "field_key": "TXN.TRIAL_AT_CURRENT"}]}'::jsonb, false),
 ('HORSE_SALE_V3','TRIAL','TRIAL.TRANSPORT_PENDING', NULL,
   '[Pending — state whether a party arranges transport of the Horse to the trial location. This placeholder is replaced by the applicable term and blocks signing.]',
   'input', 15, false,
   '{"all": [{"equals": ["YES"], "field_key": "TXN.TRIAL_ENABLED"}, {"equals": ["NO"], "field_key": "TXN.TRIAL_AT_CURRENT"}, {"equals": [""], "field_key": "TXN.TRIAL_TRANSPORT_NEEDED"}]}'::jsonb, false),
 ('HORSE_SALE_V3','TRIAL','TRIAL.TRANSPORT_BUYER', NULL,
   'Transport of the Horse to the trial location is the Buyer''s responsibility.',
   'input', 16, false,
   '{"all": [{"equals": ["YES"], "field_key": "TXN.TRIAL_ENABLED"}, {"equals": ["NO"], "field_key": "TXN.TRIAL_AT_CURRENT"}, {"equals": ["NO"], "field_key": "TXN.TRIAL_TRANSPORT_NEEDED"}]}'::jsonb, false),
 ('HORSE_SALE_V3','TRIAL','TRIAL.TRANSPORT_ARRANGED', NULL,
   'The Horse shall be transported to the trial location from the Horse''s current location. Transport is arranged by {{TXN.TRIAL_TRANSPORT_RESPONSIBLE}} and paid for by {{TXN.TRIAL_TRANSPORT_COST_RESPONSIBLE}}.',
   'input', 17, false,
   '{"all": [{"equals": ["YES"], "field_key": "TXN.TRIAL_ENABLED"}, {"equals": ["NO"], "field_key": "TXN.TRIAL_AT_CURRENT"}, {"equals": ["YES"], "field_key": "TXN.TRIAL_TRANSPORT_NEEDED"}]}'::jsonb, false)
ON CONFLICT (template_key, clause_key) DO UPDATE SET body=EXCLUDED.body, conditional_on=EXCLUDED.conditional_on, sort_order=EXCLUDED.sort_order;

-- trial arranged-by/paid-by fields now show only on the Yes branch, homed on the arranged clause
UPDATE contract_field_defs
   SET clause_key='TRIAL.TRANSPORT_ARRANGED',
       conditional_on='{"all": [{"equals": ["YES"], "field_key": "TXN.TRIAL_ENABLED"}, {"equals": ["NO"], "field_key": "TXN.TRIAL_AT_CURRENT"}, {"equals": ["YES"], "field_key": "TXN.TRIAL_TRANSPORT_NEEDED"}]}'::jsonb
 WHERE template_key='HORSE_SALE_V3' AND field_key IN ('TXN.TRIAL_TRANSPORT_RESPONSIBLE','TXN.TRIAL_TRANSPORT_COST_RESPONSIBLE');


-- ─── R3 TASK 2: BOS pre-purchase examination — FOUR states, replacing the three ──
-- Supersedes the three-state PPE built in disc_28 / R2 item-4b. The "results
-- acceptable" wording is removed entirely. States and exact wording:
--   SELLER_DECLINED          The Seller did not permit a pre-purchase veterinary
--                            examination of the Horse.
--   REQUESTED_COMPLETED      The Buyer requested a pre-purchase veterinary examination
--                            of the Horse, and the examination was completed before this
--                            Bill of Sale.
--   REQUESTED_NOT_COMPLETED  The Buyer requested a pre-purchase veterinary examination
--                            of the Horse, and the examination was not completed before
--                            this Bill of Sale.
--   WAIVED                   The Buyer was permitted to obtain a pre-purchase veterinary
--                            examination of the Horse at the Buyer's expense and waived it.
-- Each state prints a Buyer initials line, and a Co-Buyer line (own initials) when a
-- co-buyer is enabled — matching the disclosure acknowledgments.
-- Derive from an accompanying sale: Seller Declines → SELLER_DECLINED (locked);
-- Buyer Waived → WAIVED (locked); Buyer Requested → editable, limited to
-- REQUESTED_COMPLETED / REQUESTED_NOT_COMPLETED, pending blocks signing. Standalone →
-- all four selectable, pending. A lock blocker rejects any value outside the allowed
-- set for the source.

-- 2a. Remove the three-state statement + ack clauses and their ack initials fields.
DELETE FROM contract_field_defs  WHERE template_key='HORSE_BILL_OF_SALE' AND field_key  LIKE 'ACK.BOS_PPE%';
DELETE FROM contract_clause_defs WHERE template_key='HORSE_BILL_OF_SALE'
   AND clause_key LIKE 'BOS_PPE_%' AND clause_key NOT IN ('BOS_PPE_GATE','BOS_PPE_PENDING');

-- 2b. Four-state options on the selector.
UPDATE contract_field_defs
   SET options = '[
     {"label": "Seller did not permit a pre-purchase examination", "value": "SELLER_DECLINED"},
     {"label": "Buyer requested one and it was completed before this Bill of Sale", "value": "REQUESTED_COMPLETED"},
     {"label": "Buyer requested one and it was not completed before this Bill of Sale", "value": "REQUESTED_NOT_COMPLETED"},
     {"label": "Buyer was permitted one at the Buyer''s expense and waived it", "value": "WAIVED"}]'::jsonb
 WHERE template_key='HORSE_BILL_OF_SALE' AND field_key='TXN.BOS_PPE';

-- 2c. Statement + Buyer-ack + Co-Buyer-ack clauses for each state, with initials fields.
DO $ppe4$
DECLARE
  r record; v_base int; v_ackfld text; v_cbfld text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('SELLER_DECLINED', 191, 'The Seller did not permit a pre-purchase veterinary examination of the Horse.'),
      ('REQUESTED_COMPLETED', 195, 'The Buyer requested a pre-purchase veterinary examination of the Horse, and the examination was completed before this Bill of Sale.'),
      ('REQUESTED_NOT_COMPLETED', 199, 'The Buyer requested a pre-purchase veterinary examination of the Horse, and the examination was not completed before this Bill of Sale.'),
      ('WAIVED', 203, 'The Buyer was permitted to obtain a pre-purchase veterinary examination of the Horse at the Buyer''s expense and waived it.')
    ) AS t(val, srt, body)
  LOOP
    v_base := r.srt;
    v_ackfld := 'ACK.BOS_PPE_' || r.val;
    v_cbfld  := 'ACK.BOS_PPE_' || r.val || '_COBUYER';
    -- statement
    INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
    VALUES ('HORSE_BILL_OF_SALE','BOS_DISCLOSURES','BOS_PPE_'||r.val, NULL, r.body, 'input', v_base, false,
            jsonb_build_object('equals', jsonb_build_array(r.val), 'field_key','TXN.BOS_PPE'), false)
    ON CONFLICT (template_key, clause_key) DO UPDATE SET body=EXCLUDED.body, conditional_on=EXCLUDED.conditional_on, sort_order=EXCLUDED.sort_order;
    -- Buyer ack
    INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
    VALUES ('HORSE_BILL_OF_SALE','BOS_DISCLOSURES','BOS_PPE_'||r.val||'_ACK', NULL,
            'Buyer acknowledges the examination statement above and proceeds with the purchase of the Horse. Initialed: {{'||v_ackfld||'}}',
            'input', v_base+1, false,
            jsonb_build_object('equals', jsonb_build_array(r.val), 'field_key','TXN.BOS_PPE'), false)
    ON CONFLICT (template_key, clause_key) DO UPDATE SET body=EXCLUDED.body, conditional_on=EXCLUDED.conditional_on, sort_order=EXCLUDED.sort_order;
    INSERT INTO contract_field_defs (template_key, field_key, label, section, owner_role, input_kind, value_type, required, is_optional, format_type, clause_key, conditional_on, guidance)
    VALUES ('HORSE_BILL_OF_SALE', v_ackfld, 'Buyer initials', 'BOS_DISCLOSURES', 'BUYER','text','text', true, false, 'initials',
            'BOS_PPE_'||r.val||'_ACK',
            jsonb_build_object('equals', jsonb_build_array(r.val), 'field_key','TXN.BOS_PPE'),
            'Type the Buyer''s initials to acknowledge the pre-purchase examination statement.')
    ON CONFLICT (template_key, field_key) DO NOTHING;
    -- Co-Buyer ack (shown when a co-buyer is enabled)
    INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
    VALUES ('HORSE_BILL_OF_SALE','BOS_DISCLOSURES','BOS_PPE_'||r.val||'_ACK_CB', NULL,
            'Co-Buyer acknowledges the examination statement above and proceeds with the purchase of the Horse. Initialed: {{'||v_cbfld||'}}',
            'input', v_base+2, false,
            jsonb_build_object('all', jsonb_build_array(
              jsonb_build_object('equals', jsonb_build_array(r.val), 'field_key','TXN.BOS_PPE'),
              jsonb_build_object('equals', jsonb_build_array('YES'), 'field_key','TXN.CO_BUYER_ENABLED'))), false)
    ON CONFLICT (template_key, clause_key) DO UPDATE SET body=EXCLUDED.body, conditional_on=EXCLUDED.conditional_on, sort_order=EXCLUDED.sort_order;
    INSERT INTO contract_field_defs (template_key, field_key, label, section, owner_role, input_kind, value_type, required, is_optional, format_type, clause_key, conditional_on, guidance)
    VALUES ('HORSE_BILL_OF_SALE', v_cbfld, 'Co-Buyer initials', 'BOS_DISCLOSURES', 'COBUYER','text','text', true, false, 'initials',
            'BOS_PPE_'||r.val||'_ACK_CB',
            jsonb_build_object('all', jsonb_build_array(
              jsonb_build_object('equals', jsonb_build_array(r.val), 'field_key','TXN.BOS_PPE'),
              jsonb_build_object('equals', jsonb_build_array('YES'), 'field_key','TXN.CO_BUYER_ENABLED'))),
            'Type the Co-Buyer''s initials to acknowledge the pre-purchase examination statement.')
    ON CONFLICT (template_key, field_key) DO NOTHING;
  END LOOP;
END $ppe4$;

-- 2d. Rewrite the start_bill_of_sale derive for the four-state model. Seller Declines →
-- SELLER_DECLINED locked; Buyer Waived → WAIVED locked; Buyer Requested → editable,
-- options narrowed to the two REQUESTED states, blank (pending blocks signing).
DO $wire2$
DECLARE v_src text; v_new text; v_blk1 text; v_blk2 text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src FROM pg_proc WHERE proname='start_bill_of_sale';
  IF v_src IS NULL THEN RAISE EXCEPTION 'start_bill_of_sale not found'; END IF;
  IF position('REQUESTED_COMPLETED' in v_src) > 0 THEN
    RAISE NOTICE 'start_bill_of_sale already on the four-state derive; leaving as is';
    RETURN;
  END IF;
  -- Replace the whole three-state DECLARE…END derive block (inserted by R2 item-4b)
  -- with the four-state one. The block begins at the comment marker and ends at the
  -- line that restores the party fill; match on that trailing fill line.
  v_blk1 := E'  DECLARE v_ppe_choice text;\n  BEGIN';   -- start of the R2 block
  -- Build the replacement: same outer shape (DECLARE…BEGIN…END; then the party fill).
  v_new := regexp_replace(
    v_src,
    '  DECLARE v_ppe_choice text;.*?PERFORM fill_party_fields_from_contacts\(v_doc\);',
$ins$  -- BOS PPE from the sale's pre-purchase-examination election (four-state model,
  -- corrections round 3). Seller-declined and Buyer-waived derive to a locked
  -- statement; Buyer-requested is editable, limited to the two REQUESTED outcomes,
  -- and blank until the author states which occurred (a pending blocks signing).
  DECLARE v_ppe_choice text;
  BEGIN
    SELECT coalesce(btrim(value),'') INTO v_ppe_choice FROM contract_fields
      WHERE document_id = p_sale_document_id AND field_key = 'TXN.PPE_CHOICE';
    IF v_ppe_choice = 'SELLER_DECLINES' THEN
      UPDATE contract_fields SET value='SELLER_DECLINED' WHERE document_id=v_doc AND field_key='TXN.BOS_PPE';
      UPDATE contract_fields SET value='DERIVED'         WHERE document_id=v_doc AND field_key='TXN.BOS_PPE_SOURCE';
    ELSIF v_ppe_choice = 'BUYER_WAIVED' THEN
      UPDATE contract_fields SET value='WAIVED'  WHERE document_id=v_doc AND field_key='TXN.BOS_PPE';
      UPDATE contract_fields SET value='DERIVED' WHERE document_id=v_doc AND field_key='TXN.BOS_PPE_SOURCE';
    ELSIF v_ppe_choice = 'BUYER_REQUESTED' THEN
      UPDATE contract_fields SET value=''       WHERE document_id=v_doc AND field_key='TXN.BOS_PPE';
      UPDATE contract_fields SET value='AUTHOR' WHERE document_id=v_doc AND field_key='TXN.BOS_PPE_SOURCE';
      UPDATE contract_fields
         SET options='[{"label": "Buyer requested one and it was completed before this Bill of Sale", "value": "REQUESTED_COMPLETED"}, {"label": "Buyer requested one and it was not completed before this Bill of Sale", "value": "REQUESTED_NOT_COMPLETED"}]'::jsonb
       WHERE document_id=v_doc AND field_key='TXN.BOS_PPE';
    END IF;
  END;

  PERFORM fill_party_fields_from_contacts(v_doc);$ins$);
  IF v_new = v_src THEN RAISE EXCEPTION 'start_bill_of_sale: four-state derive anchor not found'; END IF;
  EXECUTE v_new;
END $wire2$;

-- 2e. Lock blocker: reject any TXN.BOS_PPE value outside the allowed set for the source,
-- so a later options sync cannot reopen a derived/locked state. Allowed sets:
--   SOURCE = DERIVED → only the single derived value already set (no change permitted);
--   SOURCE = AUTHOR  → only REQUESTED_COMPLETED / REQUESTED_NOT_COMPLETED;
--   standalone (no sale) → any of the four.
-- Appended to contract_lock_blockers before its final RETURN (after disc_25's blocker).
DO $lb$
DECLARE v_def text; v_anchor text := 'RETURN v_blockers;'; v_add text;
BEGIN
  SELECT pg_get_functiondef('public.contract_lock_blockers'::regproc) INTO v_def;
  IF position('bos_ppe_state' IN v_def) > 0 THEN RETURN; END IF;
  v_add := $q$  -- R3 task 2: BOS pre-purchase examination value must stay within the set
  -- the source allows, so a sync cannot reopen a locked state.
  DECLARE v_src2 text; v_val2 text; v_has text;
  BEGIN
    SELECT upper(btrim(coalesce(value,''))) INTO v_has FROM contract_fields
      WHERE document_id = p_document_id AND field_key = 'TXN.BOS_HAS_SALE_AGREEMENT';
    SELECT btrim(coalesce(value,'')) INTO v_val2 FROM contract_fields
      WHERE document_id = p_document_id AND field_key = 'TXN.BOS_PPE';
    SELECT btrim(coalesce(value,'')) INTO v_src2 FROM contract_fields
      WHERE document_id = p_document_id AND field_key = 'TXN.BOS_PPE_SOURCE';
    IF v_has = 'YES' AND v_val2 <> '' THEN
      IF v_src2 = 'AUTHOR' AND v_val2 NOT IN ('REQUESTED_COMPLETED','REQUESTED_NOT_COMPLETED') THEN
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
          'code','bos_ppe_state',
          'message','The pre-purchase examination status must be one the accompanying sale allows (completed or not completed).'));
      ELSIF v_src2 = 'DERIVED' AND v_val2 NOT IN ('SELLER_DECLINED','WAIVED') THEN
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
          'code','bos_ppe_state',
          'message','The pre-purchase examination status is derived from the sale and cannot be changed here.'));
      END IF;
    END IF;
  END;
  RETURN v_blockers;$q$;
  IF position(v_anchor IN v_def) = 0 THEN RAISE EXCEPTION 'contract_lock_blockers RETURN anchor not found'; END IF;
  v_def := replace(v_def, v_anchor, v_add);
  EXECUTE v_def;
END $lb$;


-- ─── R3 TASK (round 3b): move the trial transport block to AFTER the trial terms and
-- return sub-clauses, before TRIAL.INSURANCE. The block is renumbered to 14–17 (above);
-- TRIAL.INSURANCE moves 15 → 18 so it still follows the transport block, and the block
-- no longer collides with it. TRIAL.NONE stays at 20. All four transport clauses remain
-- gated on TRIAL_ENABLED = YES AND TRIAL_AT_CURRENT = NO (plus their per-clause needed
-- value), so none prints on a no-trial sale.
UPDATE contract_clause_defs SET sort_order = 18
 WHERE template_key='HORSE_SALE_V3' AND clause_key='TRIAL.INSURANCE';
