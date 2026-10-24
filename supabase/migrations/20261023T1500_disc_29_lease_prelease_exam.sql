-- Phase 29: Part 3.1 — lease pre-lease veterinary examination, trainer evaluation,
-- and evaluation period. Approved verbatim. Runs after disc_18-28.
--
-- Each of vet and trainer keeps its four existing elections (own expense / lessor's
-- expense / lessor provided / waived), but renders as FOUR clauses (one per value)
-- with the approved verbatim wording, replacing the single inline-choice clause.
--
-- Two bracketed sub-phrases appear in the approved text:
--   [timing phrase]  — a sub-election (before delivery / during the evaluation
--                      period / on or before a date), printed inline via a token
--                      whose option LABELS are the phrases.
--   [, except fees for usage that has already occurred]
--                    — prints only when the exam/eval falls in a fee-accruing
--                      period (a fixed-fee evaluation period, or the paid lease
--                      term), not when timing is before delivery or during an
--                      evaluation period included at no separate charge. Computed
--                      as a SYSTEM field in recompose_document_fields.
--
-- Both election selectors are required with a pending placeholder; the evaluation
-- period selector is required with a pending placeholder. No deposit language.

-- ── Timing sub-elections (labels ARE the bracketed phrases) ──
-- Vet 1/2 and Trainer 1/2/3 share one timing selector each. Three options; the
-- phrase prints inline where {{TXN.VET_TIMING}} / {{TXN.TRAINER_TIMING}} sits.
INSERT INTO contract_field_defs (template_key, field_key, label, section, owner_role, input_kind, value_type, required, is_optional, format_type, clause_key, options, guidance)
VALUES
 ('HORSE_LEASE_V3','TXN.VET_TIMING','Examination timing','HORSE','DEAL','select','select', false, false, 'select', 'HORSE.VET_CHECK',
  '[{"label":" before delivery of the Horse","value":"BEFORE_DELIVERY"},{"label":" during the evaluation period stated in this Agreement","value":"EVAL_PERIOD"},{"label":" on or before {{TXN.VET_TIMING_DATE}}","value":"DATE"}]'::jsonb,
  'When the examination takes place.'),
 ('HORSE_LEASE_V3','TXN.VET_TIMING_DATE','Examination by date','HORSE','DEAL','date','date', false, true, NULL, 'HORSE.VET_CHECK', NULL, NULL),
 ('HORSE_LEASE_V3','TXN.TRAINER_TIMING','Evaluation timing','HORSE','DEAL','select','select', false, false, 'select', 'HORSE.TRAINER_EVAL',
  '[{"label":" before delivery of the Horse","value":"BEFORE_DELIVERY"},{"label":" during the evaluation period stated in this Agreement","value":"EVAL_PERIOD"},{"label":" on or before {{TXN.TRAINER_TIMING_DATE}}","value":"DATE"}]'::jsonb,
  'When the evaluation takes place.'),
 ('HORSE_LEASE_V3','TXN.TRAINER_TIMING_DATE','Evaluation by date','HORSE','DEAL','date','date', false, true, NULL, 'HORSE.TRAINER_EVAL', NULL, NULL),
 ('HORSE_LEASE_V3','TXN.VET_DAYS','Days before the Agreement','HORSE','DEAL','text','text', false, true, NULL, 'HORSE.VET_CHECK', NULL, NULL),
 ('HORSE_LEASE_V3','TXN.VET_END_DATE','Results delivered by','HORSE','DEAL','date','date', false, true, NULL, 'HORSE.VET_CHECK', NULL, NULL)
ON CONFLICT (template_key, field_key) DO NOTHING;

-- The SYSTEM fee-phrase fields (computed; see recompose below). Stored, gate-free.
INSERT INTO contract_field_defs (template_key, field_key, label, section, owner_role, input_kind, value_type, required, is_optional, format_type, clause_key)
VALUES
 ('HORSE_LEASE_V3','TXN.VET_FEE_PHRASE','', 'HORSE','SYSTEM','text','text', false, true, NULL, 'HORSE.VET_CHECK'),
 ('HORSE_LEASE_V3','TXN.TRAINER_FEE_PHRASE','', 'HORSE','SYSTEM','text','text', false, true, NULL, 'HORSE.TRAINER_EVAL')
ON CONFLICT (template_key, field_key) DO NOTHING;

-- ── Vet clauses: replace the single inline-choice clause with four gated clauses. ──
-- Remove the old inline-choice field + clause body (the clause row stays as the
-- container; the four clauses below are new siblings). Drop the old choice field's
-- inline token by repurposing the HORSE.VET_CHECK clause as the pending placeholder.
UPDATE contract_clause_defs
   SET body = '[Pending — select the pre-lease veterinary examination arrangement. This placeholder is replaced by the applicable term and blocks signing.]',
       conditional_on = '{"equals": [""], "field_key": "TXN.VET_CHECK_CHOICE"}'::jsonb
 WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.VET_CHECK';
-- the choice field stays attached to HORSE.VET_CHECK (its gate carrier) and becomes required.
UPDATE contract_field_defs SET required = true WHERE template_key='HORSE_LEASE_V3' AND field_key='TXN.VET_CHECK_CHOICE';

INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem) VALUES
 ('HORSE_LEASE_V3','HORSE','HORSE.VET_CHECK_LESSEE_OWN', NULL,
  'Lessee has requested a pre-lease veterinary examination of the Horse, to be conducted at Lessee''s sole cost by a licensed veterinarian of Lessee''s choosing{{TXN.VET_TIMING}}. Lessor shall make the Horse reasonably available for the examination and shall disclose the Horse''s known medical history to the examining veterinarian on request. If the findings of the examination are not acceptable to Lessee in Lessee''s reasonable discretion, Lessee may terminate this Agreement by written notice to Lessor, and neither party has any further obligation to the other{{TXN.VET_FEE_PHRASE}}.',
  'input', 51, false, '{"equals": ["LESSEE_OWN"], "field_key": "TXN.VET_CHECK_CHOICE"}'::jsonb, false),
 ('HORSE_LEASE_V3','HORSE','HORSE.VET_CHECK_LESSEE_AT_LESSOR', NULL,
  'Lessee has requested a pre-lease veterinary examination of the Horse, to be conducted at Lessor''s cost by a licensed veterinarian of Lessee''s choosing{{TXN.VET_TIMING}}. Lessor shall make the Horse reasonably available for the examination and shall disclose the Horse''s known medical history to the examining veterinarian on request. If the findings of the examination are not acceptable to Lessee in Lessee''s reasonable discretion, Lessee may terminate this Agreement by written notice to Lessor, and neither party has any further obligation to the other{{TXN.VET_FEE_PHRASE}}.',
  'input', 52, false, '{"equals": ["LESSEE_AT_LESSOR"], "field_key": "TXN.VET_CHECK_CHOICE"}'::jsonb, false),
 ('HORSE_LEASE_V3','HORSE','HORSE.VET_CHECK_LESSOR_FREE', NULL,
  'Lessor will provide to Lessee, at no cost to Lessee, the results of a pre-lease veterinary examination of the Horse conducted by Lessor''s veterinarian, performed no more than {{TXN.VET_DAYS}} days before the date of this Agreement and delivered to Lessee no later than {{TXN.VET_END_DATE}}. If Lessor fails to provide an examination performed within that timeframe by that date, Lessee may terminate this Agreement at Lessee''s sole discretion by written notice to Lessor. If the findings of the examination are not acceptable to Lessee in Lessee''s reasonable discretion, Lessee may terminate this Agreement by written notice to Lessor, and neither party has any further obligation to the other{{TXN.VET_FEE_PHRASE}}.',
  'input', 53, false, '{"equals": ["LESSOR_FREE"], "field_key": "TXN.VET_CHECK_CHOICE"}'::jsonb, false),
 ('HORSE_LEASE_V3','HORSE','HORSE.VET_CHECK_WAIVED', NULL,
  'Lessee has been provided the option to obtain a pre-lease veterinary examination of the Horse at Lessee''s own expense and declines it. Lessee accepts the Horse without such examination and assumes the risk of conditions an examination might have revealed. This waiver does not limit Lessee''s rights arising from the disclosures and representations stated in this Agreement, or Lessee''s rights to terminate this Agreement as stated in the Termination section.',
  'input', 54, false, '{"equals": ["WAIVED"], "field_key": "TXN.VET_CHECK_CHOICE"}'::jsonb, false)
ON CONFLICT (template_key, clause_key) DO NOTHING;

-- ── Trainer clauses: parallel. ──
UPDATE contract_clause_defs
   SET body = '[Pending — select the pre-lease trainer evaluation arrangement. This placeholder is replaced by the applicable term and blocks signing.]',
       conditional_on = '{"equals": [""], "field_key": "TXN.TRAINER_EVAL_CHOICE"}'::jsonb
 WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.TRAINER_EVAL';
UPDATE contract_field_defs SET required = true WHERE template_key='HORSE_LEASE_V3' AND field_key='TXN.TRAINER_EVAL_CHOICE';

INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem) VALUES
 ('HORSE_LEASE_V3','HORSE','HORSE.TRAINER_EVAL_LESSEE_OWN', NULL,
  'Lessee has requested a suitability evaluation of the Horse by a professional trainer of Lessee''s choosing, at Lessee''s sole cost,{{TXN.TRAINER_TIMING}}. Lessor shall make the Horse reasonably available for the evaluation. If the evaluation finds the Horse unsuitable for Lessee''s intended use in Lessee''s reasonable discretion, Lessee may terminate this Agreement by written notice to Lessor, and neither party has any further obligation to the other{{TXN.TRAINER_FEE_PHRASE}}.',
  'input', 56, false, '{"equals": ["LESSEE_OWN"], "field_key": "TXN.TRAINER_EVAL_CHOICE"}'::jsonb, false),
 ('HORSE_LEASE_V3','HORSE','HORSE.TRAINER_EVAL_LESSEE_AT_LESSOR', NULL,
  'Lessee has requested a suitability evaluation of the Horse by a professional trainer of Lessee''s choosing, at Lessor''s cost,{{TXN.TRAINER_TIMING}}. Lessor shall make the Horse reasonably available for the evaluation. If the evaluation finds the Horse unsuitable for Lessee''s intended use in Lessee''s reasonable discretion, Lessee may terminate this Agreement by written notice to Lessor, and neither party has any further obligation to the other{{TXN.TRAINER_FEE_PHRASE}}.',
  'input', 57, false, '{"equals": ["LESSEE_AT_LESSOR"], "field_key": "TXN.TRAINER_EVAL_CHOICE"}'::jsonb, false),
 ('HORSE_LEASE_V3','HORSE','HORSE.TRAINER_EVAL_LESSOR_FREE', NULL,
  'Lessor will provide, at no cost to Lessee, a suitability evaluation of the Horse for Lessee''s intended use by a French Heritage Equestrian Approved Trainer{{TXN.TRAINER_TIMING}}. If the evaluation finds the Horse unsuitable for Lessee''s intended use in Lessee''s reasonable discretion, Lessee may terminate this Agreement by written notice to Lessor, and neither party has any further obligation to the other{{TXN.TRAINER_FEE_PHRASE}}.',
  'input', 58, false, '{"equals": ["LESSOR_FREE"], "field_key": "TXN.TRAINER_EVAL_CHOICE"}'::jsonb, false),
 ('HORSE_LEASE_V3','HORSE','HORSE.TRAINER_EVAL_WAIVED', NULL,
  'Lessee has been offered the opportunity to have the Horse evaluated by a professional trainer and knowingly and voluntarily waives it. Lessee accepts the Horse''s training and temperament as observed and assumes the risk of unsuitability an evaluation might have revealed. This waiver does not limit Lessee''s rights arising from the disclosures and representations stated in this Agreement, or Lessee''s rights to terminate this Agreement as stated in the Termination section.',
  'input', 59, false, '{"equals": ["WAIVED"], "field_key": "TXN.TRAINER_EVAL_CHOICE"}'::jsonb, false)
ON CONFLICT (template_key, clause_key) DO NOTHING;

-- ── Evaluation period selector: required with a pending placeholder. ──
UPDATE contract_field_defs SET required = true WHERE template_key='HORSE_LEASE_V3' AND field_key='TXN.EVALUATION_ENABLED';
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
VALUES ('HORSE_LEASE_V3','EVALUATION','EVALUATION.PENDING', NULL,
        '[Pending — select the evaluation period arrangement. This placeholder is replaced by the applicable term and blocks signing.]',
        'input', 9, false, '{"equals": [""], "field_key": "TXN.EVALUATION_ENABLED"}'::jsonb, false)
ON CONFLICT (template_key, clause_key) DO NOTHING;

-- ── Fee-phrase computation (SYSTEM fields). Prints the fee phrase only when the
--    timing falls in a fee-accruing period: a FIXED-fee evaluation period, or an
--    on-or-before date (treated as within the paid term). Not for before-delivery,
--    and not for an evaluation period INCLUDED at no separate charge. ──
CREATE OR REPLACE FUNCTION public.compose_prelease_fee_phrase(p_timing text, p_eval_type text, p_eval_enabled text)
 RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT CASE
    WHEN p_timing = 'BEFORE_DELIVERY' THEN ''
    WHEN p_timing = 'EVAL_PERIOD' AND p_eval_type = 'FIXED' THEN ', except fees for usage that has already occurred'
    WHEN p_timing = 'EVAL_PERIOD' THEN ''  -- included-at-no-charge period: no fee phrase
    WHEN p_timing = 'DATE' THEN ', except fees for usage that has already occurred'
    ELSE '' END;
$f$;

-- Wire the two SYSTEM fields into recompose_document_fields (compute from the doc's
-- timing + evaluation selections). Append before the final insurance-allocation call.
DO $rc$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.recompose_document_fields(uuid)'::regprocedure) INTO v_def;
  IF position('compose_prelease_fee_phrase' IN v_def) > 0 THEN RETURN; END IF;
  v_def := replace(v_def,
    '  PERFORM compose_insurance_allocation(p_document_id);',
    $i$  -- pre-lease fee phrases (SYSTEM): from the timing + evaluation-period fields.
  DECLARE v_vt text; v_tt text; v_et text; v_ee text; v_org uuid;
  BEGIN
    SELECT org_id INTO v_org FROM documents WHERE id = p_document_id;
    SELECT value INTO v_vt FROM contract_fields WHERE document_id=p_document_id AND field_key='TXN.VET_TIMING';
    SELECT value INTO v_tt FROM contract_fields WHERE document_id=p_document_id AND field_key='TXN.TRAINER_TIMING';
    SELECT value INTO v_et FROM contract_fields WHERE document_id=p_document_id AND field_key='TXN.EVAL_PERIOD_TYPE';
    SELECT value INTO v_ee FROM contract_fields WHERE document_id=p_document_id AND field_key='TXN.EVALUATION_ENABLED';
    IF v_org IS NOT NULL THEN
      UPDATE contract_fields SET value = compose_prelease_fee_phrase(coalesce(v_vt,''), coalesce(v_et,''), coalesce(v_ee,''))
        WHERE document_id=p_document_id AND field_key='TXN.VET_FEE_PHRASE';
      UPDATE contract_fields SET value = compose_prelease_fee_phrase(coalesce(v_tt,''), coalesce(v_et,''), coalesce(v_ee,''))
        WHERE document_id=p_document_id AND field_key='TXN.TRAINER_FEE_PHRASE';
    END IF;
  END;

  PERFORM compose_insurance_allocation(p_document_id);$i$);
  EXECUTE v_def;
END $rc$;
