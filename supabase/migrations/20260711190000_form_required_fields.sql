/*
  # Required-field control for the intake forms users see

  Owner: "I need to see and decide which fields on the intake forms that
  users see are required." The form_definitions schemas had no required
  concept at all. Now:
  - admin_form_definitions(): staff read of every active form's full schema
    (the public policy exposes only ACTIVE CLIENT forms)
  - set_form_required(form_key, {field_key: bool, ...}): admin-gated bulk
    update that stamps "required" onto the matching fields inside the
    schema jsonb. Unknown keys are ignored; structure is preserved.
  The public renderer enforces the flag; nothing is required until the owner
  checks it.
*/

CREATE OR REPLACE FUNCTION admin_form_definitions()
RETURNS TABLE (form_key text, title text, audience text, purpose text, schema jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fd.form_key, fd.title, fd.audience, fd.purpose, fd.schema
  FROM form_definitions fd
  WHERE fd.active AND has_staff_access()
  ORDER BY fd.audience, fd.title
$$;

CREATE OR REPLACE FUNCTION set_form_required(p_form_key text, p_required jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_def   jsonb;
  v_out   jsonb := '{"sections": []}'::jsonb;
  sec     jsonb;
  fld     jsonb;
  new_fields jsonb;
  v_n     integer := 0;
BEGIN
  IF NOT (has_staff_access() AND is_admin()) THEN
    RAISE EXCEPTION 'admin access required';
  END IF;

  SELECT fd.schema INTO v_def FROM form_definitions fd WHERE fd.form_key = p_form_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown form: %', p_form_key;
  END IF;

  FOR sec IN SELECT * FROM jsonb_array_elements(v_def -> 'sections')
  LOOP
    new_fields := '[]'::jsonb;
    FOR fld IN SELECT * FROM jsonb_array_elements(sec -> 'fields')
    LOOP
      IF p_required ? (fld ->> 'key') THEN
        fld := jsonb_set(fld, '{required}', p_required -> (fld ->> 'key'));
        v_n := v_n + 1;
      END IF;
      new_fields := new_fields || fld;
    END LOOP;
    v_out := jsonb_set(v_out, '{sections}',
      (v_out -> 'sections') || jsonb_set(sec, '{fields}', new_fields));
  END LOOP;

  UPDATE form_definitions SET schema = v_out, updated_at = now() WHERE form_key = p_form_key;
  RETURN v_n;
END;
$fn$;

GRANT EXECUTE ON FUNCTION admin_form_definitions() TO authenticated;
GRANT EXECUTE ON FUNCTION set_form_required(text, jsonb) TO authenticated;
