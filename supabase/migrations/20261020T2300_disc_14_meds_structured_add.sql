-- Disclosure reciprocity, phase 14: structured ADD for the medications and
-- supplements disclosure sections, field-for-field with the horse record.
--
-- The record stores meds/supplements as rows on horse_medications (name, dosage,
-- instructions, conditions_of_use). The disclosure author must add entries with the
-- SAME fields, and each added entry becomes a real row on the record at execution
-- (phase 15) — no free text jammed into a name. So the ADD control is STRUCTURED,
-- carrying exactly those four fields, and composes to the same one-line-per-entry
-- prose the record import uses (horse_meds_prose_v2), so imported and added read
-- identically.

-- 1. Composer for the structured disclosure med/supplement list.
CREATE OR REPLACE FUNCTION public.compose_disc_med(p_structured jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE it jsonb; lines text[] := ARRAY[]::text[]; part text;
BEGIN
  IF p_structured IS NULL OR coalesce(jsonb_array_length(p_structured->'discMeds'),0) = 0 THEN
    RETURN '';
  END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(p_structured->'discMeds') LOOP
    part := btrim(coalesce(it->>'name',''));
    IF coalesce(nullif(btrim(it->>'dosage'),''),'') <> '' THEN part := part || ' — ' || btrim(it->>'dosage'); END IF;
    IF coalesce(nullif(btrim(it->>'instructions'),''),'') <> '' THEN part := part || ' (' || btrim(it->>'instructions') || ')'; END IF;
    IF coalesce(nullif(btrim(it->>'conditions_of_use'),''),'') <> '' THEN part := part || ' | conditions of use: ' || btrim(it->>'conditions_of_use'); END IF;
    IF btrim(part) <> '' THEN lines := lines || part; END IF;
  END LOOP;
  RETURN array_to_string(lines, E'\n');
END $function$;

-- 2. Wire the new format into compose_field_prose (right after med_schedule).
DO $wire$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.compose_field_prose(text,jsonb,text,text)'::regprocedure) INTO v_def;
  IF position('compose_disc_med' IN v_def) > 0 THEN RETURN; END IF;
  v_def := replace(v_def,
    $o$    WHEN 'med_schedule' THEN v_out := compose_med_schedule(s);$o$,
    $n$    WHEN 'med_schedule' THEN v_out := compose_med_schedule(s);
    WHEN 'disc_med' THEN v_out := compose_disc_med(s);$n$);
  EXECUTE v_def;
END $wire$;

-- 3. ADD.MEDICATIONS / ADD.SUPPLEMENTS structured fields + ADD clauses on all three
--    templates, built off the live DISCLOSED meds/supplement clauses.
DO $add$
DECLARE
  d record;
  v_sec text;            -- MEDICATIONS | SUPPLEMENTS
  v_add_clause text;
  v_voice text;
  v_owner_role text;
  v_word text;           -- 'medications' | 'supplements'
BEGIN
  FOR d IN
    SELECT template_key, clause_key, section_key, sort_order, conditional_on, body
      FROM contract_clause_defs
     WHERE template_key IN ('HORSE_SALE_V3','HORSE_LEASE_V3','HORSE_BILL_OF_SALE')
       AND clause_key LIKE '%\_DISCLOSED'
       AND (clause_key LIKE '%MEDICATIONS%' OR clause_key LIKE '%SUPPLEMENTS%')
  LOOP
    v_sec := CASE WHEN d.clause_key LIKE '%SUPPLEMENTS%' THEN 'SUPPLEMENTS' ELSE 'MEDICATIONS' END;
    v_word := lower(v_sec);
    v_add_clause := d.clause_key || '_ADD';
    v_voice := CASE WHEN d.body LIKE 'Lessor%' THEN 'Lessor' ELSE 'Seller' END;
    SELECT owner_role INTO v_owner_role FROM contract_field_defs
      WHERE template_key = d.template_key AND field_key = 'HORSE.'||v_sec||'_GATE' LIMIT 1;
    v_owner_role := coalesce(v_owner_role, CASE WHEN v_voice='Lessor' THEN 'LESSOR' ELSE 'SELLER' END);

    INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
    VALUES (d.template_key, d.section_key, v_add_clause, NULL,
            'Additional '||v_word||' provided by the '||v_voice||': {{ADD.'||v_sec||'}}',
            'input', d.sort_order + 1, true, d.conditional_on, false)
    ON CONFLICT (template_key, clause_key) DO NOTHING;

    INSERT INTO contract_field_defs (template_key, field_key, label, section, owner_role, input_kind, value_type, required, is_optional, format_type, clause_key, conditional_on, guidance)
    VALUES (d.template_key, 'ADD.'||v_sec,
            'Add '||v_word, d.section_key, v_owner_role, 'structured', 'text',
            false, true, 'disc_med', v_add_clause, d.conditional_on,
            'Optional. Add a '||rtrim(v_word,'s')||' with its name, dosage, instructions, and conditions of use — each is saved to the horse''s record when the agreement is executed. The imported entries above cannot be edited here; change those on the record.')
    ON CONFLICT (template_key, field_key) DO NOTHING;
  END LOOP;
END $add$;
