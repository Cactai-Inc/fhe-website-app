/*
  # compose_field_prose — structured location prose

  The 'location' case only read s->>'text' (a legacy flat value), so the new
  structured location control (name + street + city/state/zip) composed to empty
  prose. This replaces just that CASE branch — server-side, so the function's
  UTF-8 content is never round-tripped through a client — to emit
  "Name — Street, City ST ZIP" from the structured parts, with the old flat
  value kept as a fallback.
*/

DO $fix$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc WHERE proname='compose_field_prose';
  IF v_def IS NULL THEN RAISE EXCEPTION 'compose_field_prose not found'; END IF;

  -- Replace the one-line location branch body with a structured composition.
  -- Match the exact current line and swap it for a block that builds parts.
  v_new := replace(
    v_def,
    E'    WHEN ''location'' THEN\n      v_out := coalesce(nullif(s->>''text'',''''), p_value, '''');',
    E'    WHEN ''location'' THEN\n'
    || E'      v_parts := ARRAY[]::text[];\n'
    || E'      IF coalesce(s->>''name'','''')  <> '''' THEN v_parts := v_parts || (s->>''name''); END IF;\n'
    || E'      IF coalesce(s->>''line1'','''') <> '''' THEN v_parts := v_parts || (s->>''line1''); END IF;\n'
    || E'      IF coalesce(s->>''city'','''')  <> '''' OR coalesce(s->>''state'','''') <> '''' OR coalesce(s->>''postal'','''') <> '''' THEN\n'
    || E'        v_parts := v_parts || btrim(concat_ws('' '', concat_ws('', '', nullif(s->>''city'',''''), nullif(s->>''state'','''')), nullif(s->>''postal'','''')));\n'
    || E'      END IF;\n'
    || E'      v_out := array_to_string(v_parts, '' — '');\n'
    || E'      IF v_out = '''' THEN v_out := coalesce(nullif(s->>''text'',''''), p_value, ''''); END IF;'
  );

  IF v_new = v_def THEN
    RAISE EXCEPTION 'location branch not found to replace — compose_field_prose shape changed';
  END IF;

  EXECUTE v_new;
END
$fix$;
