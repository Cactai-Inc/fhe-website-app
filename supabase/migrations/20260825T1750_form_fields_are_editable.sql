-- ADD, REMOVE AND EDIT FORM FIELDS — safe now that forms version on change.
--
-- Owner, 2026-08-25: the form editor *"was supposed to let me edit the fields, add
-- and remove fields, and edit the menu contents"*, and — on the orphaning worry —
-- *"we established that changes create versions of the file they are changing for
-- forms and docs, so nothing can be orphaned."*
--
-- Right, and now true for forms too: 20260825T1740 gave them the version history
-- documents already had, and stamped `booking_forms.form_version`. So a removed or
-- renamed field is not lost — the version its answers were collected under is
-- retained, and that is the shape those answers are read against.
--
-- EVERY mutator below opens with `snapshot_form_definition`, which retains the
-- OUTGOING shape and returns the next version number. That is what makes the
-- guarantee real rather than a convention someone has to remember.

BEGIN;

-- ── the two incumbent mutators learn to version ──────────────────────────────
-- set_form_required previously wrote the schema and left `version` alone, which is
-- why max(version) was still 1 across all 28 forms.
CREATE OR REPLACE FUNCTION public.set_form_required(p_form_key text, p_required jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_def   jsonb; v_out jsonb := '{"sections": []}'::jsonb;
  sec jsonb; fld jsonb; new_fields jsonb; v_n integer := 0; v_next integer;
BEGIN
  IF NOT coalesce(has_staff_access() AND is_admin(), false) THEN
    RAISE EXCEPTION 'admin access required';
  END IF;
  SELECT fd.schema INTO v_def FROM form_definitions fd WHERE fd.form_key = p_form_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown form: %', p_form_key; END IF;

  v_next := snapshot_form_definition(p_form_key);

  FOR sec IN SELECT * FROM jsonb_array_elements(v_def -> 'sections') LOOP
    new_fields := '[]'::jsonb;
    FOR fld IN SELECT * FROM jsonb_array_elements(sec -> 'fields') LOOP
      IF p_required ? (fld ->> 'key') THEN
        fld := jsonb_set(fld, '{required}', p_required -> (fld ->> 'key'));
        v_n := v_n + 1;
      END IF;
      new_fields := new_fields || fld;
    END LOOP;
    v_out := jsonb_set(v_out, '{sections}',
      (v_out -> 'sections') || jsonb_set(sec, '{fields}', new_fields));
  END LOOP;

  UPDATE form_definitions SET schema = v_out, version = v_next, updated_at = now()
   WHERE form_key = p_form_key;
  RETURN v_n;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_form_field_options(
  p_form_key text, p_field_key text, p_options text[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_schema jsonb; v_new jsonb; v_next integer;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admin only'; END IF;
  IF p_options IS NULL OR array_length(p_options, 1) IS NULL THEN
    RAISE EXCEPTION 'a menu needs at least one option';
  END IF;
  SELECT schema INTO v_schema FROM form_definitions WHERE form_key = p_form_key;
  IF v_schema IS NULL THEN RAISE EXCEPTION 'unknown form %', p_form_key; END IF;

  v_next := snapshot_form_definition(p_form_key);

  SELECT jsonb_build_object('sections', jsonb_agg(sec ORDER BY sec_i)) INTO v_new
    FROM (
      SELECT sec_i, jsonb_set(s, '{fields}', (
               SELECT jsonb_agg(
                        CASE WHEN f->>'key' = p_field_key AND f ? 'options'
                             THEN jsonb_set(f, '{options}', to_jsonb(p_options))
                             ELSE f END ORDER BY f_i)
                 FROM jsonb_array_elements(s->'fields') WITH ORDINALITY AS t(f, f_i))) AS sec
        FROM jsonb_array_elements(v_schema->'sections') WITH ORDINALITY AS q(s, sec_i)
    ) x;

  UPDATE form_definitions SET schema = v_new, version = v_next, updated_at = now()
   WHERE form_key = p_form_key;
END;
$function$;

-- ── edit one field: its label, its type, its key ─────────────────────────────
/**
 * ⚠️ RENAMING THE KEY IS ALLOWED, AND ONLY BECAUSE OF THE VERSION HISTORY.
 * `booking_forms.answers` is keyed by field `key`, so a rename would once have
 * detached every stored answer. Now the version those answers were collected under
 * is retained in `form_definition_versions` and named by
 * `booking_forms.form_version`, so the old key is still resolvable against the shape
 * it belonged to. Nothing is orphaned — which is the whole reason this can ship.
 */
CREATE OR REPLACE FUNCTION public.edit_form_field(
  p_form_key text, p_field_key text,
  p_label text DEFAULT NULL, p_type text DEFAULT NULL, p_new_key text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_schema jsonb; v_new jsonb; v_next integer; v_key text := nullif(btrim(coalesce(p_new_key,'')),'');
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT schema INTO v_schema FROM form_definitions WHERE form_key = p_form_key;
  IF v_schema IS NULL THEN RAISE EXCEPTION 'unknown form %', p_form_key; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_schema->'sections') s,
                  jsonb_array_elements(s->'fields') f WHERE f->>'key' = p_field_key
  ) THEN RAISE EXCEPTION 'no field % on form %', p_field_key, p_form_key; END IF;
  IF v_key IS NOT NULL AND v_key <> p_field_key AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_schema->'sections') s,
                  jsonb_array_elements(s->'fields') f WHERE f->>'key' = v_key
  ) THEN RAISE EXCEPTION 'form % already has a field called %', p_form_key, v_key; END IF;

  v_next := snapshot_form_definition(p_form_key);

  SELECT jsonb_build_object('sections', jsonb_agg(sec ORDER BY sec_i)) INTO v_new
    FROM (
      SELECT sec_i, jsonb_set(s, '{fields}', (
               SELECT jsonb_agg(
                        CASE WHEN f->>'key' <> p_field_key THEN f
                        ELSE f
                             || CASE WHEN nullif(btrim(coalesce(p_label,'')),'') IS NOT NULL
                                     THEN jsonb_build_object('label', btrim(p_label)) ELSE '{}'::jsonb END
                             || CASE WHEN nullif(btrim(coalesce(p_type,'')),'') IS NOT NULL
                                     THEN jsonb_build_object('type', btrim(p_type)) ELSE '{}'::jsonb END
                             || CASE WHEN v_key IS NOT NULL
                                     THEN jsonb_build_object('key', v_key) ELSE '{}'::jsonb END
                        END ORDER BY f_i)
                 FROM jsonb_array_elements(s->'fields') WITH ORDINALITY AS t(f, f_i))) AS sec
        FROM jsonb_array_elements(v_schema->'sections') WITH ORDINALITY AS q(s, sec_i)
    ) x;

  UPDATE form_definitions SET schema = v_new, version = v_next, updated_at = now()
   WHERE form_key = p_form_key;
END;
$function$;

-- ── add a field to a section ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_form_field(
  p_form_key text, p_section_heading text, p_key text, p_label text,
  p_type text DEFAULT 'text', p_options text[] DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_schema jsonb; v_new jsonb; v_next integer;
  v_key text := nullif(btrim(coalesce(p_key,'')),'');
  v_field jsonb;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admin only'; END IF;
  IF v_key IS NULL OR nullif(btrim(coalesce(p_label,'')),'') IS NULL THEN
    RAISE EXCEPTION 'a field needs a key and a label';
  END IF;
  SELECT schema INTO v_schema FROM form_definitions WHERE form_key = p_form_key;
  IF v_schema IS NULL THEN RAISE EXCEPTION 'unknown form %', p_form_key; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_schema->'sections') s,
                           jsonb_array_elements(s->'fields') f WHERE f->>'key' = v_key)
  THEN RAISE EXCEPTION 'form % already has a field called %', p_form_key, v_key; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_schema->'sections') s
                  WHERE s->>'heading' = p_section_heading)
  THEN RAISE EXCEPTION 'no section "%" on form %', p_section_heading, p_form_key; END IF;

  v_next := snapshot_form_definition(p_form_key);

  v_field := jsonb_build_object('key', v_key, 'label', btrim(p_label),
                                'type', coalesce(nullif(btrim(coalesce(p_type,'')),''), 'text'))
    || CASE WHEN p_options IS NOT NULL AND array_length(p_options,1) IS NOT NULL
            THEN jsonb_build_object('options', to_jsonb(p_options)) ELSE '{}'::jsonb END;

  SELECT jsonb_build_object('sections', jsonb_agg(
           CASE WHEN s->>'heading' = p_section_heading
                THEN jsonb_set(s, '{fields}', (s->'fields') || v_field)
                ELSE s END ORDER BY sec_i)) INTO v_new
    FROM jsonb_array_elements(v_schema->'sections') WITH ORDINALITY AS q(s, sec_i);

  UPDATE form_definitions SET schema = v_new, version = v_next, updated_at = now()
   WHERE form_key = p_form_key;
END;
$function$;

-- ── remove a field ───────────────────────────────────────────────────────────
/** The field leaves the LIVE shape; the version that carried it is retained, and
 *  every answer set already collected names that version. Nothing is orphaned. */
CREATE OR REPLACE FUNCTION public.remove_form_field(p_form_key text, p_field_key text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_schema jsonb; v_new jsonb; v_next integer;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT schema INTO v_schema FROM form_definitions WHERE form_key = p_form_key;
  IF v_schema IS NULL THEN RAISE EXCEPTION 'unknown form %', p_form_key; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_schema->'sections') s,
                              jsonb_array_elements(s->'fields') f WHERE f->>'key' = p_field_key)
  THEN RAISE EXCEPTION 'no field % on form %', p_field_key, p_form_key; END IF;

  v_next := snapshot_form_definition(p_form_key);

  SELECT jsonb_build_object('sections', jsonb_agg(sec ORDER BY sec_i)) INTO v_new
    FROM (
      SELECT sec_i, jsonb_set(s, '{fields}',
               coalesce((SELECT jsonb_agg(f ORDER BY f_i)
                           FROM jsonb_array_elements(s->'fields') WITH ORDINALITY AS t(f, f_i)
                          WHERE f->>'key' <> p_field_key), '[]'::jsonb)) AS sec
        FROM jsonb_array_elements(v_schema->'sections') WITH ORDINALITY AS q(s, sec_i)
    ) x;

  UPDATE form_definitions SET schema = v_new, version = v_next, updated_at = now()
   WHERE form_key = p_form_key;
END;
$function$;

-- ── an answer set is stamped with the shape it was collected under ───────────
CREATE OR REPLACE FUNCTION public._ensure_booking_form(p_booking bookings)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_service text; v_key text;
BEGIN
  SELECT id INTO v_id FROM booking_forms WHERE booking_id = p_booking.id;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  v_service := booking_service_type(p_booking);
  v_key     := booking_form_key(v_service);

  INSERT INTO booking_forms (org_id, booking_id, form_key, form_definition_id, service_type, form_version)
  VALUES (p_booking.org_id, p_booking.id, v_key,
          (SELECT fd.id FROM form_definitions fd WHERE fd.form_key = v_key),
          v_service,
          (SELECT fd.version FROM form_definitions fd WHERE fd.form_key = v_key))
  ON CONFLICT (booking_id) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.snapshot_form_definition(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.edit_form_field(text, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_form_field(text, text, text, text, text, text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_form_field(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_form_field(text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_form_field(text, text, text, text, text, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_form_field(text, text) TO authenticated, service_role;

COMMIT;
