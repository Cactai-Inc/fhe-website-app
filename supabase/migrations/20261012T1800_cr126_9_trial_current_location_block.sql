-- CR-126 round 2 — when the trial location IS the horse's current location, the
-- contract should say so with a "Current Location" label and the location name +
-- address beneath it, rather than a bare inline "…at {location}." (owner request).
--
-- Mechanism mirrors transport (#7): a SYSTEM-computed field TXN.TRIAL_AT_CURRENT set
-- in recompose_document_fields via locations_match, and two gated variants of the
-- trial intro sentence. Unsigned drafts only (D33); template bumped after (D34).

-- The computed flag field.
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   format_type, required, is_optional, sort_order, closed)
SELECT 'HORSE_SALE_V2','TXN.TRIAL_AT_CURRENT','Trial at current location','TRIAL','SYSTEM',
       'text','text','text', false, true, 362, false
 WHERE NOT EXISTS (SELECT 1 FROM contract_field_defs
                    WHERE template_key='HORSE_SALE_V2' AND field_key='TXN.TRIAL_AT_CURRENT');

-- The trial intro sentence becomes two variants:
--   DIFFERENT (or unknown) location → the inline sentence, unchanged.
--   SAME AS CURRENT → the sentence ends at the dates, then a "Current Location"
--     labelled block (the location token on its own "Current Location: {{…}}" line,
--     which the renderer shows as a label with the name + address beneath it).
-- The board-cost line and the rest of TRIAL.TERMS are unchanged (they live in the
-- clause's later lines / sibling clauses already).
UPDATE contract_clause_defs
   SET conditional_on = '{"all":[{"equals":["YES"],"field_key":"TXN.TRIAL_ENABLED"},{"any":[{"equals":["NO"],"field_key":"TXN.TRIAL_AT_CURRENT"},{"equals":[""],"field_key":"TXN.TRIAL_AT_CURRENT"}]}]}'::jsonb
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'TRIAL.TERMS';

-- SAME-AS-CURRENT variant: same body but the first sentence drops "at {location}"
-- and a "Current Location" labelled block follows on its own line. Cloned from
-- TRIAL.TERMS so section/sort/type match; mutually exclusive by TRIAL_AT_CURRENT.
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
SELECT template_key, section_key, 'TRIAL.TERMS_CURRENT', heading,
       'Buyer may keep and ride the Horse on trial from {{TXN.TRIAL_START}} to {{TXN.TRIAL_END}} at the Horse''s current location.
Current Location: {{TXN.TRIAL_LOCATION}}
During the trial period, the costs of the Horse''s board, care, and routine maintenance are borne by {{TXN.TRIAL_BOARD_COST}}.
Buyer shall use the Horse only for ordinary riding and evaluation consistent with the Horse''s training and shall not compete, breed, transport offsite (other than for veterinary care, which is always permitted), or permit third parties to ride the Horse without Seller''s written consent, and Buyer assumes all risk of injury to persons arising from the Horse during the trial period as provided in the Risk, Release, and Indemnification section of this Agreement. Seller bears the risk of loss of the Horse while Seller holds title. If the Horse dies or is injured before Closing, Buyer is entitled to the return of all amounts paid to Seller and may decline to complete the purchase by not executing the Bill of Sale, in which case Seller returns to Buyer all amounts paid and Buyer returns possession of the Horse to Seller. Nothing in this section limits Seller''s remedies for damage to the Horse caused by Buyer''s gross negligence, reckless conduct, or intentional misconduct. Unless written notice is given and approved by Seller, Buyer must return the Horse in substantially the condition received on or before {{TXN.TRIAL_END}} or execute this Agreement.',
       clause_type, sort_order, is_optional,
       '{"all":[{"equals":["YES"],"field_key":"TXN.TRIAL_ENABLED"},{"equals":["YES"],"field_key":"TXN.TRIAL_AT_CURRENT"}]}'::jsonb,
       render_as_subitem
  FROM contract_clause_defs
 WHERE template_key='HORSE_SALE_V2' AND clause_key='TRIAL.TERMS'
   AND NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key='HORSE_SALE_V2' AND clause_key='TRIAL.TERMS_CURRENT');

-- Compute TXN.TRIAL_AT_CURRENT in recompose_document_fields: YES when the trial
-- location matches the horse's current location (so the server body picks the
-- "Current Location" variant). In-place rewrite, injected before the insurance
-- allocation step (same anchor the transport block uses).
DO $cr126_trialcur$
DECLARE
  v_def text;
  v_anchor text := '  -- 3. LEASEFIX 2026-08-09: derived insurance cost allocation.';
  v_block text := $block$  -- CR-126: TXN.TRIAL_AT_CURRENT — YES when the trial location equals the horse's
  -- current location. Drives the "Current Location" trial-intro variant.
  IF EXISTS (SELECT 1 FROM contract_fields
              WHERE document_id = p_document_id AND field_key = 'TXN.TRIAL_LOCATION') THEN
    DECLARE v_tl RECORD; v_cl RECORD; v_m boolean; v_org3 uuid;
    BEGIN
      SELECT org_id INTO v_org3 FROM documents WHERE id = p_document_id;
      SELECT structured, value INTO v_tl FROM contract_fields
        WHERE document_id = p_document_id AND field_key = 'TXN.TRIAL_LOCATION';
      SELECT structured, value INTO v_cl FROM contract_fields
        WHERE document_id = p_document_id AND field_key = 'HORSE.CURRENT_LOCATION';
      v_m := locations_match(v_tl.structured, v_tl.value, v_cl.structured, v_cl.value);
      INSERT INTO contract_fields (org_id, document_id, field_key, owner_role, value,
                                   value_type, is_optional, included, sort_order)
      VALUES (v_org3, p_document_id, 'TXN.TRIAL_AT_CURRENT', 'SYSTEM',
              CASE WHEN v_m IS TRUE THEN 'YES' ELSE 'NO' END,
              'text', true, false, 0)
      ON CONFLICT (document_id, field_key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = now()
        WHERE contract_fields.value IS DISTINCT FROM EXCLUDED.value;
    END;
  END IF;

$block$;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc
    WHERE proname='recompose_document_fields' AND pronamespace='public'::regnamespace;
  IF position(v_anchor IN v_def) = 0 THEN
    RAISE EXCEPTION 'recompose anchor not found';
  END IF;
  v_def := replace(v_def, v_anchor, v_block || v_anchor);
  EXECUTE v_def;
END $cr126_trialcur$;
