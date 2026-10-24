-- Disclosure rebuild, phase 20: structured entries + bracketed text composers.
--
-- Each imported section now renders the same way on every surface. Two outputs
-- per section, both derived from the record's structured list / rows:
--   * horse_section_entries(horse, section) -> jsonb array of entries, each an
--     ORDERED array of {label, value} in the record's field order; empty fields
--     carry their label with value ''; an empty entry carries every label empty;
--     booleans render 'Yes'/'No'. This is what the PDF and the on-screen boxed
--     component consume (stored on the document's HORSE.<SECTION> field.structured,
--     frozen at execution).
--   * horse_field_token_value(horse,'<SECTION>') -> the readable text block the
--     token {{HORSE.<SECTION>}} expands to, wrapped in the disclosure markers:
--         [[DISCLOSURE:<SECTION>]]
--         Entry 1:
--           Label: value
--           Label:
--         [[/DISCLOSURE]]
--     Component-capable surfaces draw boxes and drop the block between the markers;
--     the executed snapshot / plain readers drop the two marker lines and keep the
--     block. The markers never print.
--
-- Injuries-to-humans is a scalar (phase 19) and is NOT one of these sections — it
-- has no entries and renders through its own No/Yes/Unknown clauses.

-- ── field-order + label spec, one source of truth for both outputs ──
-- A SQL function returning the ordered (key,label,kind) spec per section.
CREATE OR REPLACE FUNCTION public.disclosure_section_spec(p_section text)
 RETURNS TABLE(k text, label text, kind text)
 LANGUAGE sql IMMUTABLE AS $function$
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
    ('INJURIES_TO_HORSE', 4, 'status', 'Status', 'text')
  ) AS s(section, ord, k, label, kind)
  WHERE s.section = p_section
  ORDER BY s.ord;
$function$;

-- One entry's {label,value} array from a jsonb list entry, per the section spec.
-- `occurrence` kind renders 'Current' when current=true, else the date value.
CREATE OR REPLACE FUNCTION public.disclosure_entry_fields(p_section text, p_entry jsonb)
 RETURNS jsonb
 LANGUAGE sql IMMUTABLE AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'label', s.label,
    'value', CASE
      WHEN s.kind = 'occurrence' THEN
        CASE WHEN coalesce((p_entry->>'current')::boolean, false) THEN 'Current'
             ELSE coalesce(nullif(btrim(p_entry->>s.k),''), '') END
      ELSE coalesce(nullif(btrim(p_entry->>s.k),''), '') END
  ) ORDER BY s.ord), '[]'::jsonb)
  FROM disclosure_section_spec(p_section) WITH ORDINALITY AS s(k, label, kind, ord);
$function$;

-- Structured entries for a list section: one {label,value}[] per entry, in order.
-- Medications/supplements come from horse_medications (their own field set).
CREATE OR REPLACE FUNCTION public.horse_section_entries(v_horse horses, p_section text)
 RETURNS jsonb
 LANGUAGE plpgsql STABLE AS $function$
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
      fields := jsonb_build_array(
        jsonb_build_object('label','Name',         'value', coalesce(nullif(btrim(m.name),''),'')),
        jsonb_build_object('label','Purpose',      'value', coalesce(nullif(btrim(m.purpose),''),'')),
        jsonb_build_object('label','Dose',         'value', coalesce(nullif(btrim(m.dosage),''),'')),
        jsonb_build_object('label','Frequency',    'value', coalesce(nullif(btrim(m.frequency),''),'')),
        jsonb_build_object('label','Cost per dose','value', coalesce(nullif(btrim(m.cost_per_dose),''),'')),
        jsonb_build_object('label','Rx required',  'value', CASE WHEN m.rx_required IS TRUE THEN 'Yes' WHEN m.rx_required IS FALSE THEN 'No' ELSE '' END)
      );
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

-- Readable text block (the fallback), wrapped in the disclosure markers.
CREATE OR REPLACE FUNCTION public.horse_section_text_block(v_horse horses, p_section text)
 RETURNS text
 LANGUAGE plpgsql STABLE AS $function$
DECLARE entries jsonb; e jsonb; f jsonb; lines text[] := ARRAY[]::text[]; n int := 0;
BEGIN
  entries := horse_section_entries(v_horse, p_section);
  FOR e IN SELECT * FROM jsonb_array_elements(entries) LOOP
    n := n + 1;
    lines := lines || ('Entry ' || n || ':');
    FOR f IN SELECT * FROM jsonb_array_elements(e) LOOP
      lines := lines || ('  ' || (f->>'label') || ': ' || (f->>'value'));
    END LOOP;
  END LOOP;
  IF n = 0 THEN RETURN ''; END IF;  -- gate yes with no entries: no block, reads clean
  RETURN '[[DISCLOSURE:' || p_section || ']]' || E'\n'
       || array_to_string(lines, E'\n') || E'\n'
       || '[[/DISCLOSURE]]';
END $function$;

-- Repoint horse_field_token_value: the six list sections now expand to the
-- bracketed text block; drop the old prose composers' use. Injuries-to-humans
-- (scalar) was already repointed in phase 19.
DO $hftv$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.horse_field_token_value(horses,text)'::regprocedure) INTO v_def;
  v_def := replace(v_def,
    $o$    WHEN 'KNOWN_CONDITIONS'        THEN horse_conditions_prose(v_horse.known_conditions_list)$o$,
    $n$    WHEN 'KNOWN_CONDITIONS'        THEN horse_section_text_block(v_horse, 'KNOWN_CONDITIONS')$n$);
  v_def := replace(v_def,
    $o$    WHEN 'MEDICAL_HISTORY'         THEN horse_medical_prose(v_horse.medical_history_list)$o$,
    $n$    WHEN 'MEDICAL_HISTORY'         THEN horse_section_text_block(v_horse, 'MEDICAL_HISTORY')$n$);
  v_def := replace(v_def,
    $o$    WHEN 'BEHAVIORAL_HISTORY'      THEN horse_behavior_prose(v_horse.behavioral_history_list)$o$,
    $n$    WHEN 'BEHAVIORAL_HISTORY'      THEN horse_section_text_block(v_horse, 'BEHAVIORAL_HISTORY')$n$);
  v_def := replace(v_def,
    $o$    WHEN 'INJURIES_TO_HORSE'       THEN horse_injuries_horse_prose(v_horse.injuries_to_horse)$o$,
    $n$    WHEN 'INJURIES_TO_HORSE'       THEN horse_section_text_block(v_horse, 'INJURIES_TO_HORSE')$n$);
  v_def := replace(v_def,
    $o$    WHEN 'MEDICATIONS'             THEN horse_meds_prose_v2(v_horse.id, 'MEDICATION')$o$,
    $n$    WHEN 'MEDICATIONS'             THEN horse_section_text_block(v_horse, 'MEDICATIONS')$n$);
  v_def := replace(v_def,
    $o$    WHEN 'SUPPLEMENTS'             THEN horse_meds_prose_v2(v_horse.id, 'SUPPLEMENT')$o$,
    $n$    WHEN 'SUPPLEMENTS'             THEN horse_section_text_block(v_horse, 'SUPPLEMENTS')$n$);
  EXECUTE v_def;
END $hftv$;

-- Store the structured entries on the document's HORSE.<SECTION> field.structured
-- in BOTH fill paths (attach + the record-save trigger), so the entries freeze onto
-- the document and are never re-read from the horse. A helper keeps one definition.
CREATE OR REPLACE FUNCTION public.set_document_disclosure_structured(p_document_id uuid, v_horse horses)
 RETURNS void
 LANGUAGE plpgsql AS $function$
DECLARE sec text;
BEGIN
  FOREACH sec IN ARRAY ARRAY['KNOWN_CONDITIONS','MEDICAL_HISTORY','BEHAVIORAL_HISTORY','INJURIES_TO_HORSE','MEDICATIONS','SUPPLEMENTS'] LOOP
    UPDATE contract_fields
       SET structured = horse_section_entries(v_horse, sec), updated_at = now()
     WHERE document_id = p_document_id AND field_key = 'HORSE.' || sec;
  END LOOP;
END $function$;

-- Restructure the six DISCLOSED clause bodies so the {{HORSE.<SECTION>}} token —
-- which now expands to a multi-line marker block — is the LAST element, on its own
-- line after a colon. Previously bodies read "... as follows: {{TOKEN}}. <closing
-- sentence>", which glued the closing sentence onto [[/DISCLOSURE]]. We move
-- everything after the token to before it and end with the token alone. Each of
-- the 18 bodies (6 sections x 3 documents) is set EXPLICITLY — no generic transform
-- — so the legal wording is exactly as authored. The meds/supplement enumerations
-- are corrected to the imported field set (name, purpose, dose, frequency, cost per
-- dose, whether a prescription is required); the others keep their field lists.
-- Sentence(s) read fully, then the token sits last on its own line.
UPDATE contract_clause_defs SET body =
  'Lessor has disclosed to Lessee all known material information regarding the Horse''s medical conditions (ongoing or episodic), lameness, allergies, vices, and prior veterinary concerns. Lessor represents that these disclosures are true and complete to Lessor''s knowledge as of the Effective Date. The disclosed conditions are as follows:' || E'\n' || '{{HORSE.KNOWN_CONDITIONS}}'
 WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.KNOWN_CONDITIONS_DISCLOSED';
UPDATE contract_clause_defs SET body =
  'Lessor discloses the Horse''s medical history (treatments past and ongoing), with all known information relating to description, date, type, and status, as follows:' || E'\n' || '{{HORSE.MEDICAL_HISTORY}}'
 WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.MEDICAL_HISTORY_DISCLOSED';
UPDATE contract_clause_defs SET body =
  'Lessor discloses the following adverse behaviors, with all known information relating to description, trigger, and current status or date of last occurrence, as follows:' || E'\n' || '{{HORSE.BEHAVIORAL_HISTORY}}'
 WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.BEHAVIORAL_HISTORY_DISCLOSED';
UPDATE contract_clause_defs SET body =
  'Lessor discloses the following injuries the Horse has experienced, with all known information relating to description, date or date range, outcome, and status, as follows:' || E'\n' || '{{HORSE.INJURIES_TO_HORSE}}'
 WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.INJURIES_TO_HORSE_DISCLOSED';
UPDATE contract_clause_defs SET body =
  'Lessor discloses the following medications, with all known information relating to name, purpose, dose, frequency, cost per dose, and whether a prescription is required, as follows:' || E'\n' || '{{HORSE.MEDICATIONS}}'
 WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.MEDICATIONS_DISCLOSED';
UPDATE contract_clause_defs SET body =
  'Lessor discloses the following supplements, with all known information relating to name, purpose, dose, frequency, cost per dose, and whether a prescription is required, as follows:' || E'\n' || '{{HORSE.SUPPLEMENTS}}'
 WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.SUPPLEMENTS_DISCLOSED';

UPDATE contract_clause_defs SET body =
  'Seller has disclosed to Buyer all known material information regarding the Horse''s medical conditions (ongoing or episodic), lameness, allergies, vices, and prior veterinary concerns. Seller warrants that these disclosures are true and complete to Seller''s knowledge as of the Effective Date, and shall promptly disclose any material change arising before Closing. The disclosed conditions are as follows:' || E'\n' || '{{HORSE.KNOWN_CONDITIONS}}'
 WHERE template_key='HORSE_SALE_V3' AND clause_key='HORSE.KNOWN_CONDITIONS_DISCLOSED';
UPDATE contract_clause_defs SET body =
  'Seller discloses the Horse''s medical history (treatments past and ongoing), with all known information relating to description, date, type, and status, as follows:' || E'\n' || '{{HORSE.MEDICAL_HISTORY}}'
 WHERE template_key='HORSE_SALE_V3' AND clause_key='HORSE.MEDICAL_HISTORY_DISCLOSED';
UPDATE contract_clause_defs SET body =
  'Seller discloses the following adverse behaviors, with all known information relating to description, trigger, and current status or date of last occurrence, as follows:' || E'\n' || '{{HORSE.BEHAVIORAL_HISTORY}}'
 WHERE template_key='HORSE_SALE_V3' AND clause_key='HORSE.BEHAVIORAL_HISTORY_DISCLOSED';
UPDATE contract_clause_defs SET body =
  'Seller discloses the following injuries the Horse has experienced, with all known information relating to description, date or date range, outcome, and status, as follows:' || E'\n' || '{{HORSE.INJURIES_TO_HORSE}}'
 WHERE template_key='HORSE_SALE_V3' AND clause_key='HORSE.INJURIES_TO_HORSE_DISCLOSED';
UPDATE contract_clause_defs SET body =
  'Seller discloses the following medications, with all known information relating to name, purpose, dose, frequency, cost per dose, and whether a prescription is required, as follows:' || E'\n' || '{{HORSE.MEDICATIONS}}'
 WHERE template_key='HORSE_SALE_V3' AND clause_key='HORSE.MEDICATIONS_DISCLOSED';
UPDATE contract_clause_defs SET body =
  'Seller discloses the following supplements, with all known information relating to name, purpose, dose, frequency, cost per dose, and whether a prescription is required, as follows:' || E'\n' || '{{HORSE.SUPPLEMENTS}}'
 WHERE template_key='HORSE_SALE_V3' AND clause_key='HORSE.SUPPLEMENTS_DISCLOSED';

UPDATE contract_clause_defs SET body =
  'Seller has disclosed to Buyer all known material information regarding the Horse''s medical conditions (ongoing or episodic), lameness, allergies, vices, and prior veterinary concerns. Seller represents that these disclosures are true and complete to Seller''s knowledge as of the date of this Bill of Sale. The disclosed conditions are as follows:' || E'\n' || '{{HORSE.KNOWN_CONDITIONS}}'
 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_KNOWN_CONDITIONS_DISCLOSED';
UPDATE contract_clause_defs SET body =
  'Seller discloses the Horse''s medical history (treatments past and ongoing), with all known information relating to description, date, type, and status, as follows:' || E'\n' || '{{HORSE.MEDICAL_HISTORY}}'
 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_MEDICAL_HISTORY_DISCLOSED';
UPDATE contract_clause_defs SET body =
  'Seller discloses the following adverse behaviors, with all known information relating to description, trigger, and current status or date of last occurrence, as follows:' || E'\n' || '{{HORSE.BEHAVIORAL_HISTORY}}'
 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_BEHAVIORAL_HISTORY_DISCLOSED';
UPDATE contract_clause_defs SET body =
  'Seller discloses the following injuries the Horse has experienced, with all known information relating to description, date or date range, outcome, and status, as follows:' || E'\n' || '{{HORSE.INJURIES_TO_HORSE}}'
 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_INJURIES_TO_HORSE_DISCLOSED';
UPDATE contract_clause_defs SET body =
  'Seller discloses the following medications, with all known information relating to name, purpose, dose, frequency, cost per dose, and whether a prescription is required, as follows:' || E'\n' || '{{HORSE.MEDICATIONS}}'
 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_MEDICATIONS_DISCLOSED';
UPDATE contract_clause_defs SET body =
  'Seller discloses the following supplements, with all known information relating to name, purpose, dose, frequency, cost per dose, and whether a prescription is required, as follows:' || E'\n' || '{{HORSE.SUPPLEMENTS}}'
 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_SUPPLEMENTS_DISCLOSED';

-- Wire the structured write into the ATTACH fill path: right after it fills the
-- HORSE.* value fields, before it recomposes.
DO $att$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.attach_horse_to_document(uuid,uuid)'::regprocedure) INTO v_def;
  IF position('set_document_disclosure_structured' IN v_def) > 0 THEN RETURN; END IF;
  v_def := replace(v_def,
    $o$    UPDATE contract_fields
       SET value = horse_field_token_value(v_horse, r.field), updated_at = now()
     WHERE id = r.id;
  END LOOP;
$o$,
    $n$    UPDATE contract_fields
       SET value = horse_field_token_value(v_horse, r.field), updated_at = now()
     WHERE id = r.id;
  END LOOP;

  PERFORM set_document_disclosure_structured(p_document_id, v_horse);
$n$);
  EXECUTE v_def;
END $att$;

-- Wire the structured write into the SYNC trigger: after each doc's value loop,
-- refresh its disclosure structured and force a recompose so the markers/text
-- stay in step even when only entries (not the text value) changed.
--
-- The per-horse sync body is factored into sync_horse_documents(old,new) so BOTH
-- the horses-row trigger and the medications statement-trigger call ONE
-- implementation. `p_force` makes it refresh + recompose even when no HORSE.* text
-- value diverged — the medications path needs that, because a med change does not
-- change any horses column, so the value-diff alone would see nothing.
CREATE OR REPLACE FUNCTION public.sync_horse_documents(p_old horses, p_new horses, p_force boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE d record; f record; v_new text; v_old text; v_changed boolean;
BEGIN
  FOR d IN
    SELECT doc.id, ct.template_key FROM documents doc
    JOIN contract_templates ct ON ct.id = doc.template_id
    WHERE doc.horse_id = p_new.id
      AND doc.deleted_at IS NULL
      AND doc.workflow_state IN ('editable', 'editing', 'in_review')
  LOOP
    BEGIN
      v_changed := p_force;
      FOR f IN
        SELECT cf.id, cf.value,
               upper(split_part(regexp_replace(cf.field_key, '[{}]', '', 'g'), '.', 2)) AS field
        FROM contract_fields cf
        WHERE cf.document_id = d.id
          AND regexp_replace(cf.field_key, '[{}]', '', 'g') LIKE 'HORSE.%'
      LOOP
        v_new := horse_field_token_value(p_new, f.field);
        v_old := horse_field_token_value(p_old, f.field);
        -- Disclosure CONTENT tokens are pure read-only imports (no author path
        -- since ADD was removed) → always refresh to the record value.
        -- Disclosure GATES refresh to the record value ONLY when the record has
        -- entries (derived YES/UNKNOWN non-empty = locked); when the record is
        -- empty the gate is the AUTHOR's own selection and must be preserved.
        -- Both bypass the typed-field divergence-preservation that guards the
        -- other HORSE.* fields (microchip, vet, farrier…). This also makes the
        -- medications path (p_old = p_new) refresh the gate correctly.
        IF f.field IN ('KNOWN_CONDITIONS','MEDICAL_HISTORY','BEHAVIORAL_HISTORY',
                       'INJURIES_TO_HORSE','INJURIES_TO_HUMANS','MEDICATIONS','SUPPLEMENTS') THEN
          IF f.value IS DISTINCT FROM v_new THEN
            UPDATE contract_fields SET value = v_new, updated_at = now() WHERE id = f.id;
            v_changed := true;
          END IF;
        ELSIF f.field IN ('KNOWN_CONDITIONS_GATE','MEDICAL_HISTORY_GATE','BEHAVIORAL_HISTORY_GATE',
                          'INJURIES_TO_HORSE_GATE','MEDICATIONS_GATE','SUPPLEMENTS_GATE') THEN
          -- list-section gate: record-derived is YES iff the list has entries. Lock
          -- to YES when it does; when empty (derived NO) leave the author's answer.
          IF v_new = 'YES' AND f.value IS DISTINCT FROM 'YES' THEN
            UPDATE contract_fields SET value = 'YES', updated_at = now() WHERE id = f.id;
            v_changed := true;
          END IF;
        ELSIF f.field = 'INJURIES_TO_HUMANS_GATE' THEN
          -- injuries-to-humans is answered on the RECORD (Yes/No/Unknown), never on
          -- the contract — so the contract gate always mirrors the record scalar.
          IF f.value IS DISTINCT FROM v_new THEN
            UPDATE contract_fields SET value = v_new, updated_at = now() WHERE id = f.id;
            v_changed := true;
          END IF;
        ELSIF (f.value IS NULL OR btrim(f.value) = '' OR f.value = v_old)
           AND f.value IS DISTINCT FROM v_new THEN
          UPDATE contract_fields SET value = v_new, updated_at = now() WHERE id = f.id;
          v_changed := true;
        END IF;
      END LOOP;
      PERFORM set_document_disclosure_structured(d.id, p_new);
      IF v_changed THEN
        IF EXISTS (SELECT 1 FROM contract_section_defs s WHERE s.template_key = d.template_key) THEN
          PERFORM remerge_contract_from_clauses(d.id);
        ELSE
          PERFORM remerge_contract_from_fields(d.id);
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- one document's failure never blocks the save
    END;
  END LOOP;
END $function$;

-- The horses-row trigger is now a thin wrapper over the shared core.
CREATE OR REPLACE FUNCTION public.sync_horse_fields_to_documents()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM sync_horse_documents(OLD, NEW, false);
  RETURN NEW;
END $function$;
