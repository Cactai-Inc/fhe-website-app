-- CR-126 — a location printed its NAME twice ("Carmel Creek Ranch — Carmel Creek
-- Ranch, San Diego, CA") because the known-location data stores the full address
-- (name included) in line1, and compose_field_prose concatenated name — address.
-- Fix: when the composed address already BEGINS with the name, drop the redundant
-- "name — " prefix so the name prints once. In-place rewrite of the 'location'
-- branch of compose_field_prose (dollar-quoted to avoid escaping confusion).

DO $cr126_locdedup$
DECLARE
  v_def text;
  v_old text := $q$    WHEN 'location' THEN
      v_out := nullif(btrim(concat_ws(' — ', nullif(s->>'name',''),
                 compose_address(s->>'line1', s->>'line2', s->>'city', s->>'state', s->>'postal'))), '');$q$;
  v_new text := $q$    WHEN 'location' THEN
      DECLARE v_lname text := btrim(coalesce(s->>'name','')); v_laddr text := btrim(coalesce(compose_address(s->>'line1', s->>'line2', s->>'city', s->>'state', s->>'postal'),'')); BEGIN
        IF v_laddr <> '' AND v_lname <> '' AND lower(v_laddr) LIKE lower(v_lname) || '%' THEN
          v_out := v_laddr;   -- address already contains the name: print it once
        ELSE
          v_out := nullif(btrim(concat_ws(' — ', nullif(v_lname,''), nullif(v_laddr,''))), '');
        END IF;
      END;$q$;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc
    WHERE proname='compose_field_prose' AND pronamespace='public'::regnamespace;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'location branch anchor not found — body changed';
  END IF;
  v_def := replace(v_def, v_old, v_new);
  EXECUTE v_def;
END $cr126_locdedup$;
