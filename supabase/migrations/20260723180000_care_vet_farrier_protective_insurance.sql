-- §13 Care fixes + insurance line break.

-- ── (A) Protective equipment: make the Yes/No selectable ─────────────────────
-- Deadlock: the "Horse must wear protective equipment" Yes/No field lived on the
-- CARE.PROTECTIVE clause, which was itself gated on that field = YES — so the
-- buttons only appeared once already YES, and could never be selected. Move the
-- Yes/No onto an always-visible header line; keep the equipment detail gated.
UPDATE contract_clause_defs
   SET body = 'Horse must wear protective equipment: {{TXN.PROTECTIVE_REQUIRED}}',
       conditional_on = NULL
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'CARE.PROTECTIVE';

-- the Yes/No field moves to the now-ungated header clause
UPDATE contract_field_defs
   SET clause_key = 'CARE.PROTECTIVE', conditional_on = NULL
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.PROTECTIVE_REQUIRED';

-- the equipment detail clause stays gated on YES (unchanged gate, already correct)
UPDATE contract_clause_defs
   SET conditional_on = '{"equals": ["YES"], "field_key": "TXN.PROTECTIVE_REQUIRED"}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'CARE.PROTECTIVE_EQUIP';

-- ── (B) Vet / Farrier contact folded into the care clause, line-gated ────────
-- The composer now honors a FIELD's conditional_on at the LINE level (see the
-- composer patch at the bottom of this file), so the "Veterinarian:"/"Farrier:"
-- line can live inside the main care clause and appear ONLY when the Lessee is
-- the party arranging that care — grouped right under the costs line.
UPDATE contract_clause_defs
   SET body = 'Party responsible for arranging: {{TXN.VET_ARRANGE}}' || E'\n'
           || 'Party responsible for costs: {{TXN.VET_COST_PARTY}}' || E'\n'
           || 'Veterinarian: {{HORSE.VET}}'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'CARE.ROUTINE_VET';

UPDATE contract_clause_defs
   SET body = 'Party responsible for arranging: {{TXN.FARRIER_ARRANGE}}' || E'\n'
           || 'Party responsible for costs: {{TXN.FARRIER_COST_PARTY}}' || E'\n'
           || 'Farrier: {{HORSE.FARRIER}}'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'CARE.FARRIER';

-- move the fields onto the main clauses + gate them on arrange = LESSEE (the
-- composer applies this gate per line, and the authoring surface already hides a
-- field whose conditional_on is unmet).
UPDATE contract_field_defs
   SET clause_key = 'CARE.ROUTINE_VET',
       conditional_on = '{"equals": ["LESSEE"], "field_key": "TXN.VET_ARRANGE"}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'HORSE.VET';
UPDATE contract_field_defs
   SET clause_key = 'CARE.FARRIER',
       conditional_on = '{"equals": ["LESSEE"], "field_key": "TXN.FARRIER_ARRANGE"}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'HORSE.FARRIER';

-- remove the now-redundant separate contact clauses
DELETE FROM contract_clause_defs
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key IN ('CARE.VET_CONTACT', 'CARE.FARRIER_CONTACT');

-- ── composer: honor a FIELD's conditional_on at the line level ───────────────
-- A clause-body line whose token is a field with an unmet conditional_on is
-- dropped from the composed document (previously only whole CLAUSES were gated).
DO $mig$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('remerge_contract_from_clauses'::regproc);
  v_def := replace(v_def,
$old$          v_toks := ARRAY(SELECT (regexp_matches(v_line, '\{\{([A-Z0-9_.]+)\}\}', 'g'))[1]);
          v_any_token := coalesce(array_length(v_toks,1),0) > 0;
          IF NOT v_any_token THEN v_cl_buf := array_append(v_cl_buf, v_line); CONTINUE; END IF;$old$,
$new$          v_toks := ARRAY(SELECT (regexp_matches(v_line, '\{\{([A-Z0-9_.]+)\}\}', 'g'))[1]);
          v_any_token := coalesce(array_length(v_toks,1),0) > 0;
          IF NOT v_any_token THEN v_cl_buf := array_append(v_cl_buf, v_line); CONTINUE; END IF;
          -- line-level field gating: if any token on this line is a field with an
          -- unmet conditional_on, drop the whole line.
          IF EXISTS (
            SELECT 1 FROM unnest(v_toks) t
             JOIN contract_field_defs fdg
               ON fdg.template_key = v_tkey AND fdg.field_key = t
            WHERE fdg.conditional_on IS NOT NULL
              AND NOT clause_condition_met(fdg.conditional_on, v_fields)
          ) THEN CONTINUE; END IF;$new$);
  IF v_def NOT LIKE '%line-level field gating%' THEN
    RAISE EXCEPTION 'composer: line loop not found for field gating';
  END IF;
  EXECUTE v_def;
END $mig$;

-- ── (C) Insurance: 30-day sentence onto its own line ────────────────────────
UPDATE contract_clause_defs
   SET body = 'The parties agree that the following insurance shall be carried on the Horse during the term of this Agreement, obtained and maintained as set out below.' || E'\n'
           || 'Insurance must be obtained within 30 days of the date of signing of this Agreement.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.INSURANCE';
