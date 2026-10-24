-- disc_35: make disclosure_section_spec the single DB source for ALL SIX disclosure
-- sections' box labels. Medications and supplements carried their labels as literals
-- inside horse_section_entries; move them into disclosure_section_spec alongside the
-- four list sections (same (section, ord, k, label, kind) shape), and have
-- horse_section_entries read its med/supp labels from the spec instead of its own
-- literals. The 'bool' kind renders rx_required as Yes/No.

CREATE OR REPLACE FUNCTION public.disclosure_section_spec(p_section text)
 RETURNS TABLE(k text, label text, kind text)
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT s.k, s.label, s.kind FROM (VALUES
    ('KNOWN_CONDITIONS', 1, 'description', 'Description', 'text'),
    ('KNOWN_CONDITIONS', 2, 'trigger', 'Trigger', 'text'),
    ('KNOWN_CONDITIONS', 3, 'last_occurrence', 'Current or Date of last occurrence', 'occurrence'),
    ('KNOWN_CONDITIONS', 4, 'accommodations', 'Accommodations', 'text'),
    ('MEDICAL_HISTORY', 1, 'description', 'Description', 'text'),
    ('MEDICAL_HISTORY', 2, 'date', 'Date', 'text'),
    ('MEDICAL_HISTORY', 3, 'type', 'Type', 'text'),
    ('MEDICAL_HISTORY', 4, 'status', 'Status', 'text'),
    ('BEHAVIORAL_HISTORY', 1, 'description', 'Description', 'text'),
    ('BEHAVIORAL_HISTORY', 2, 'trigger', 'Trigger', 'text'),
    ('BEHAVIORAL_HISTORY', 3, 'last_occurrence', 'Current or Date of last occurrence', 'occurrence'),
    ('INJURIES_TO_HORSE', 1, 'description', 'Description', 'text'),
    ('INJURIES_TO_HORSE', 2, 'date', 'Date or date range', 'text'),
    ('INJURIES_TO_HORSE', 3, 'outcome', 'Outcome', 'text'),
    ('INJURIES_TO_HORSE', 4, 'status', 'Status', 'text'),
    -- Medications and supplements: the labels horse_section_entries used to hold as
    -- literals, now here in the same shape. k = the horse_medications column.
    ('MEDICATIONS', 1, 'name', 'Name', 'text'),
    ('MEDICATIONS', 2, 'purpose', 'Purpose', 'text'),
    ('MEDICATIONS', 3, 'dosage', 'Dose', 'text'),
    ('MEDICATIONS', 4, 'frequency', 'Frequency', 'text'),
    ('MEDICATIONS', 5, 'cost_per_dose', 'Cost per dose', 'text'),
    ('MEDICATIONS', 6, 'rx_required', 'Rx required', 'bool'),
    ('SUPPLEMENTS', 1, 'name', 'Name', 'text'),
    ('SUPPLEMENTS', 2, 'purpose', 'Purpose', 'text'),
    ('SUPPLEMENTS', 3, 'dosage', 'Dose', 'text'),
    ('SUPPLEMENTS', 4, 'frequency', 'Frequency', 'text'),
    ('SUPPLEMENTS', 5, 'cost_per_dose', 'Cost per dose', 'text'),
    ('SUPPLEMENTS', 6, 'rx_required', 'Rx required', 'bool')
  ) AS s(section, ord, k, label, kind)
  WHERE s.section = p_section
  ORDER BY s.ord;
$function$;

-- horse_section_entries: build med/supp field labels from the spec, not literals.
-- The medication row is selected once; each spec field maps its key to the row's value
-- (rx_required as Yes/No via the 'bool' kind). List sections are unchanged.
CREATE OR REPLACE FUNCTION public.horse_section_entries(v_horse horses, p_section text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE v_list jsonb; e jsonb; out jsonb := '[]'::jsonb; m record; fields jsonb;
BEGIN
  IF p_section IN ('MEDICATIONS','SUPPLEMENTS') THEN
    FOR m IN
      SELECT name, purpose, dosage, frequency, cost_per_dose, rx_required
        FROM horse_medications
       WHERE horse_id = v_horse.id AND deleted_at IS NULL
         AND kind = CASE WHEN p_section='SUPPLEMENTS' THEN 'SUPPLEMENT' ELSE 'MEDICATION' END
       ORDER BY sort_order, name
    LOOP
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'label', s.label,
        'value', CASE
          WHEN s.kind = 'bool' THEN
            CASE WHEN (to_jsonb(m)->>s.k)::boolean IS TRUE THEN 'Yes'
                 WHEN (to_jsonb(m)->>s.k)::boolean IS FALSE THEN 'No'
                 ELSE '' END
          ELSE coalesce(nullif(btrim(to_jsonb(m)->>s.k), ''), '') END
      ) ORDER BY s.ord), '[]'::jsonb)
        INTO fields
        FROM disclosure_section_spec(p_section) WITH ORDINALITY AS s(k, label, kind, ord);
      out := out || jsonb_build_array(fields);
    END LOOP;
    RETURN out;
  END IF;

  v_list := CASE p_section
    WHEN 'KNOWN_CONDITIONS'   THEN v_horse.known_conditions_list
    WHEN 'MEDICAL_HISTORY'    THEN v_horse.medical_history_list
    WHEN 'BEHAVIORAL_HISTORY' THEN v_horse.behavioral_history_list
    WHEN 'INJURIES_TO_HORSE'  THEN v_horse.injuries_to_horse
    ELSE '[]'::jsonb END;

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(v_list,'[]'::jsonb)) LOOP
    out := out || jsonb_build_array(disclosure_entry_fields(p_section, e));
  END LOOP;
  RETURN out;
END $function$;
