/*
  # compose_field_prose — contact-block + yes/no formats (Pass I-c)

  Adds prose composition for the two new field types:
    contact  → "Name, Business, Street, City ST ZIP, Phone, Email, Website"
    yesno    → "Yes" / "No"

  Server-side targeted insert before the existing 'person' case (function is pure
  ASCII, no round-trip corruption risk).
*/

DO $patch$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc WHERE proname='compose_field_prose';
  IF v_def IS NULL THEN RAISE EXCEPTION 'compose_field_prose not found'; END IF;

  v_new := replace(
    v_def,
    E'    WHEN ''person'' THEN',
    E'    WHEN ''yesno'' THEN\n'
    || E'      v_out := CASE upper(coalesce(s->>''value'', p_value, '''')) WHEN ''YES'' THEN ''Yes'' WHEN ''NO'' THEN ''No'' ELSE coalesce(p_value,'''') END;\n'
    || E'\n'
    || E'    WHEN ''contact'' THEN\n'
    || E'      v_parts := ARRAY[]::text[];\n'
    || E'      IF coalesce(s->>''name'','''')    <> '''' THEN v_parts := v_parts || (s->>''name''); END IF;\n'
    || E'      IF coalesce(s->>''company'','''') <> '''' THEN v_parts := v_parts || (s->>''company''); END IF;\n'
    || E'      IF coalesce(s->>''line1'','''')   <> '''' THEN v_parts := v_parts || (s->>''line1''); END IF;\n'
    || E'      IF coalesce(s->>''city'','''')    <> '''' OR coalesce(s->>''state'','''') <> '''' OR coalesce(s->>''postal'','''') <> '''' THEN\n'
    || E'        v_parts := v_parts || btrim(concat_ws('' '', concat_ws('', '', nullif(s->>''city'',''''), nullif(s->>''state'','''')), nullif(s->>''postal'','''')));\n'
    || E'      END IF;\n'
    || E'      IF coalesce(s->>''phone'','''')   <> '''' THEN v_parts := v_parts || (s->>''phone''); END IF;\n'
    || E'      IF coalesce(s->>''email'','''')   <> '''' THEN v_parts := v_parts || (s->>''email''); END IF;\n'
    || E'      IF coalesce(s->>''website'','''') <> '''' THEN v_parts := v_parts || (s->>''website''); END IF;\n'
    || E'      v_out := array_to_string(v_parts, '', '');\n'
    || E'      IF v_out = '''' THEN v_out := needs(coalesce(p_label,''contact'')); END IF;\n'
    || E'\n'
    || E'    WHEN ''person'' THEN'
  );

  IF v_new = v_def THEN
    RAISE EXCEPTION 'person case not found in compose_field_prose — shape changed';
  END IF;
  EXECUTE v_new;
END
$patch$;
