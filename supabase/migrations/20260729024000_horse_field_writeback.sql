-- ─────────────────────────────────────────────────────────────────────────────
-- BIDIRECTIONAL HORSE SYNC — contract → horse record direction (owner request).
--
-- When a party fills any HORSE.* field on a document with an attached horse
-- (horse_id set), the value feeds back to the horses record — the same as if it
-- had been entered on the horse intake form. Hooked into set_contract_field and
-- set_field_structured via contract_horse_field_writeback():
--
--   • open workflow states only (editable / editing / in_review) — never from
--     locked or executed documents;
--   • capture_horse_record_info's authorization pattern: staff-in-org OR any
--     document party (deliberately allows a non-owner party to supply missing
--     details, which the horse owner then confirms via confirm_horse_section);
--   • token ↔ column map mirrors attach_horse_to_document (reversed where 1:1;
--     display values reverse-looked-up to codes; composed/derived tokens —
--     locations, medication prose, euthanasia flags — are NOT written back);
--   • never clobbers: an empty contract value writes nothing, and a horses
--     column that already holds a DIFFERENT non-empty value is left unchanged
--     (the contract field still saves; returns 'conflict' for the caller/audit);
--   • idempotent: when the horses value already equals the incoming value the
--     UPDATE is skipped ('unchanged') — so the companion horses→contract
--     re-materialization trigger (built by another thread) cannot loop.
--
-- The helper RETURNS a disposition code and never raises for sync problems —
-- the contract-field write must succeed regardless.
--
-- NOTE (repo convention): the two hook patches rewrite live function bodies in
-- place (pg_get_functiondef → strict replace → re-execute); not replayable on a
-- fresh database, like the ~31 prior in-place migrations.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.contract_horse_field_writeback(
  p_document_id uuid, p_field_key text, p_value text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc   documents%ROWTYPE;
  v_field text;
  v_new   text := btrim(coalesce(p_value, ''));
  v_col   text;
  v_cur   text;
  v_num   numeric;
  v_date  date;
  v_code  text;
BEGIN
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND OR v_doc.horse_id IS NULL THEN RETURN 'no_horse'; END IF;
  IF v_doc.workflow_state NOT IN ('editable','editing','in_review') THEN RETURN 'closed_state'; END IF;
  IF NOT ((has_staff_access() AND v_doc.org_id = current_org())
          OR caller_is_document_party(p_document_id)) THEN
    RETURN 'not_authorized';
  END IF;
  IF v_new = '' THEN RETURN 'empty_skipped'; END IF;  -- supplies data, never erases

  v_field := upper(split_part(regexp_replace(p_field_key, '[{}]', '', 'g'), '.', 2));

  CASE v_field
    WHEN 'REGISTERED_NAME'     THEN v_col := 'registered_name';
    WHEN 'BARN_NAME'           THEN v_col := 'nickname';
    WHEN 'SEX'                 THEN v_col := 'sex';
    WHEN 'HEIGHT'              THEN v_col := 'height';
    WHEN 'REGISTRATION_NUMBER' THEN v_col := 'registration_number';
    WHEN 'MICROCHIP'           THEN v_col := 'microchip_id';
    WHEN 'PASSPORT_NUMBER'     THEN v_col := 'passport_number';
    WHEN 'VET_NAME'            THEN v_col := 'vet_name';
    WHEN 'VET_PHONE'           THEN v_col := 'vet_phone';
    WHEN 'VET_BUSINESS'        THEN v_col := 'vet_business_name';
    -- full string into line1 — the same convention the capture UI path uses
    WHEN 'VET_ADDRESS'         THEN v_col := 'vet_address_line1';
    WHEN 'FARRIER_NAME'        THEN v_col := 'farrier_name';
    WHEN 'FARRIER_PHONE'       THEN v_col := 'farrier_phone';
    WHEN 'KNOWN_CONDITIONS'    THEN v_col := 'known_conditions';
    WHEN 'TRAINING_HISTORY'    THEN v_col := 'training_history';
    WHEN 'COMPETITION_HISTORY' THEN v_col := 'competition_history';
    WHEN 'MEDICAL_HISTORY'     THEN v_col := 'medical_history';
    WHEN 'BEHAVIORAL_HISTORY'  THEN v_col := 'behavioral_history';
    WHEN 'MARKINGS'            THEN v_col := 'markings';
    WHEN 'REGISTRATION_ORG'    THEN v_col := 'registration_org';
    WHEN 'PASSPORT_COUNTRY'    THEN v_col := 'passport_country';
    WHEN 'BREED'               THEN v_col := 'breed';
    WHEN 'COLOR'               THEN v_col := 'color';
    WHEN 'FAIR_MARKET_VALUE'   THEN v_col := 'fair_market_value';
    WHEN 'AGE_DOB'             THEN v_col := 'date_of_birth';
    ELSE RETURN 'unmapped';  -- composed/derived tokens are one-way (record → doc)
  END CASE;

  -- reverse-map display values to stored codes / typed values
  IF v_field = 'BREED' THEN
    SELECT code INTO v_code FROM horse_breeds
     WHERE lower(display_name) = lower(v_new) OR code = upper(v_new) LIMIT 1;
    IF v_code IS NULL THEN RETURN 'unmapped_value'; END IF;
    v_new := v_code;
  ELSIF v_field = 'COLOR' THEN
    SELECT code INTO v_code FROM horse_colors
     WHERE lower(display_name) = lower(v_new) OR code = upper(v_new) LIMIT 1;
    IF v_code IS NULL THEN RETURN 'unmapped_value'; END IF;
    v_new := v_code;
  ELSIF v_field IN ('MARKINGS','REGISTRATION_ORG','PASSPORT_COUNTRY') THEN
    SELECT code INTO v_code FROM lookup_options
     WHERE lookup_key = CASE v_field WHEN 'MARKINGS' THEN 'horse_markings'
                                     WHEN 'REGISTRATION_ORG' THEN 'horse_registration_org'
                                     ELSE 'horse_passport_country' END
       AND (lower(display_name) = lower(v_new) OR code = v_new) LIMIT 1;
    v_new := coalesce(v_code, v_new);  -- these columns legally hold raw text too
  ELSIF v_field = 'FAIR_MARKET_VALUE' THEN
    BEGIN
      v_num := nullif(regexp_replace(v_new, '[^0-9.]', '', 'g'), '')::numeric;
    EXCEPTION WHEN others THEN v_num := NULL; END;
    IF v_num IS NULL THEN RETURN 'unparseable'; END IF;
  ELSIF v_field = 'AGE_DOB' THEN
    BEGIN
      v_date := v_new::date;
    EXCEPTION WHEN others THEN
      BEGIN
        v_date := to_date(v_new, 'FMMonth FMDD, YYYY');
      EXCEPTION WHEN others THEN v_date := NULL; END;
    END;
    IF v_date IS NULL THEN RETURN 'unparseable'; END IF;
  END IF;

  -- no-silent-clobber + idempotence, then the (typed) write
  IF v_field = 'FAIR_MARKET_VALUE' THEN
    SELECT fair_market_value::text INTO v_cur FROM horses WHERE id = v_doc.horse_id AND deleted_at IS NULL;
    IF v_cur IS NULL AND NOT EXISTS (SELECT 1 FROM horses WHERE id = v_doc.horse_id AND deleted_at IS NULL) THEN RETURN 'no_horse'; END IF;
    IF v_cur IS NOT NULL THEN
      IF v_cur::numeric = v_num THEN RETURN 'unchanged'; ELSE RETURN 'conflict'; END IF;
    END IF;
    UPDATE horses SET fair_market_value = v_num, updated_at = now() WHERE id = v_doc.horse_id;
    RETURN 'written';
  ELSIF v_field = 'AGE_DOB' THEN
    SELECT date_of_birth::text INTO v_cur FROM horses WHERE id = v_doc.horse_id AND deleted_at IS NULL;
    IF v_cur IS NULL AND NOT EXISTS (SELECT 1 FROM horses WHERE id = v_doc.horse_id AND deleted_at IS NULL) THEN RETURN 'no_horse'; END IF;
    IF v_cur IS NOT NULL THEN
      IF v_cur::date = v_date THEN RETURN 'unchanged'; ELSE RETURN 'conflict'; END IF;
    END IF;
    UPDATE horses SET date_of_birth = v_date, updated_at = now() WHERE id = v_doc.horse_id;
    RETURN 'written';
  ELSE
    EXECUTE format('SELECT btrim(coalesce(%I, '''')) FROM horses WHERE id = $1 AND deleted_at IS NULL', v_col)
      INTO v_cur USING v_doc.horse_id;
    IF v_cur IS NULL THEN RETURN 'no_horse'; END IF;
    IF v_cur <> '' THEN
      IF v_cur = v_new THEN RETURN 'unchanged'; ELSE RETURN 'conflict'; END IF;
    END IF;
    EXECUTE format('UPDATE horses SET %I = $2, updated_at = now() WHERE id = $1', v_col)
      USING v_doc.horse_id, v_new;
    RETURN 'written';
  END IF;
END;
$function$;

-- ── hook the two field writers ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp._patch_fn(p_name text, p_old text, p_new text)
RETURNS void LANGUAGE plpgsql AS $patch$
DECLARE v_oid oid; v_src text; v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = p_name;
  IF v_n <> 1 THEN RAISE EXCEPTION 'expected exactly one public.%, found %', p_name, v_n; END IF;
  SELECT p.oid INTO v_oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = p_name;
  v_src := pg_get_functiondef(v_oid);
  IF position(p_old IN v_src) = 0 THEN
    RAISE EXCEPTION 'pattern not found in %: %', p_name, p_old;
  END IF;
  v_src := replace(v_src, p_old, p_new);
  EXECUTE v_src;
END;
$patch$;

-- set_contract_field: after the scalar write (and horse-unconfirm), feed the
-- value back to the horses record.
SELECT pg_temp._patch_fn('set_contract_field',
E'  IF p_field_key LIKE ''HORSE.%'' AND v_confirmed IS NOT NULL THEN\n    UPDATE documents\n       SET horse_section_confirmed_at = NULL,\n           horse_section_confirmed_by = NULL\n     WHERE id = p_document_id;\n  END IF;',
E'  IF p_field_key LIKE ''HORSE.%'' AND v_confirmed IS NOT NULL THEN\n    UPDATE documents\n       SET horse_section_confirmed_at = NULL,\n           horse_section_confirmed_by = NULL\n     WHERE id = p_document_id;\n  END IF;\n\n  -- bidirectional horse sync (contract → record): open states only, party or\n  -- staff, never clobbers a differing value, idempotent when unchanged.\n  IF p_field_key LIKE ''HORSE.%'' THEN\n    PERFORM contract_horse_field_writeback(p_document_id, p_field_key, p_value);\n  END IF;');

-- set_field_structured: after recompose, feed the recomposed prose back.
SELECT pg_temp._patch_fn('set_field_structured',
E'  SELECT value INTO v_new_prose FROM contract_fields\n    WHERE document_id = p_document_id AND field_key = p_field_key;',
E'  SELECT value INTO v_new_prose FROM contract_fields\n    WHERE document_id = p_document_id AND field_key = p_field_key;\n  IF p_field_key LIKE ''HORSE.%'' THEN\n    PERFORM contract_horse_field_writeback(p_document_id, p_field_key, v_new_prose);\n  END IF;');

DROP FUNCTION pg_temp._patch_fn(text, text, text);

COMMIT;
