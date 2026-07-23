-- Fix: the schedule week-grid rendered as raw JSON in the composed document.
--
-- The week-grid stored its JSON in contract_fields.value (with structured = NULL),
-- and compose_field_prose had no 'week_grid' case, so the JSON was dumped verbatim
-- into the document. We move the week grid onto the SAME model as the other
-- structured builders (med_schedule, fee_schedule, …): JSON lives in `structured`,
-- and compose_field_prose renders it to prose from there. (The frontend WeekGrid
-- is updated to read/write `structured` in the same commit.)

-- day-selection + optional time windows → readable prose.
CREATE OR REPLACE FUNCTION public.compose_week_grid(p jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  v_party text; v_days jsonb; v_lines text[] := ARRAY[]::text[];
  v_daylist text; w jsonb; v_win text[] := ARRAY[]::text[]; v_out text;
  v_order text[] := ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN RETURN ''; END IF;

  FOR v_party IN SELECT jsonb_array_elements_text(coalesce(p->'parties','[]'::jsonb)) LOOP
    v_days := coalesce(p->'days'->v_party, '[]'::jsonb);
    SELECT string_agg(d, ', ' ORDER BY array_position(v_order, d))
      INTO v_daylist FROM jsonb_array_elements_text(v_days) AS d;
    IF coalesce(nullif(btrim(v_daylist),''),'') <> '' THEN
      v_lines := v_lines || (v_party || ': ' || v_daylist);
    END IF;
  END LOOP;

  IF coalesce(array_length(v_lines,1),0) = 0 THEN RETURN ''; END IF;
  v_out := array_to_string(v_lines, '; ') || '.';

  IF coalesce((p->>'timeframes')::boolean, false)
     AND jsonb_array_length(coalesce(p->'windows','[]'::jsonb)) > 0 THEN
    FOR w IN SELECT * FROM jsonb_array_elements(p->'windows') LOOP
      IF coalesce(w->>'start','') <> '' AND coalesce(w->>'end','') <> '' THEN
        v_win := v_win || (fmt_time12(w->>'start') || ' – ' || fmt_time12(w->>'end'));
      END IF;
    END LOOP;
    IF coalesce(array_length(v_win,1),0) > 0 THEN
      v_out := v_out || ' Time windows: ' || array_to_string(v_win, ', ') || '.';
    END IF;
  END IF;
  RETURN v_out;
END;
$function$;

-- "06:00" → "6:00 AM"; passes through anything not HH:MM.
CREATE OR REPLACE FUNCTION public.fmt_time12(t text)
 RETURNS text LANGUAGE sql IMMUTABLE AS $function$
  SELECT CASE WHEN t ~ '^\d{1,2}:\d{2}$'
    THEN to_char(to_timestamp(t, 'HH24:MI'), 'FMHH12:MI AM') ELSE coalesce(t,'') END;
$function$;

-- add the 'week_grid' case to compose_field_prose (reads `structured`, like the
-- other builders).
DO $mig$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('compose_field_prose'::regproc);
  v_def := replace(v_def,
$old$    ELSE
      v_out := coalesce(nullif(s->>'value',''), nullif(s->>'text',''), p_value, '');
  END CASE;$old$,
$new$    WHEN 'week_grid' THEN v_out := compose_week_grid(s);
    ELSE
      v_out := coalesce(nullif(s->>'value',''), nullif(s->>'text',''), p_value, '');
  END CASE;$new$);
  IF v_def NOT LIKE '%compose_week_grid(s)%' THEN RAISE EXCEPTION 'compose_field_prose: ELSE not found'; END IF;
  EXECUTE v_def;
END $mig$;

-- DATA: migrate any existing week-grid JSON from value → structured, so it renders
-- from the new path. Leaves `value` for recompose to overwrite with the prose.
UPDATE contract_fields cf
   SET structured = cf.value::jsonb
  FROM contract_field_defs fd
 WHERE fd.field_key = cf.field_key
   AND fd.format_type = 'week_grid'
   AND (cf.structured IS NULL OR cf.structured = '{}'::jsonb)
   AND cf.value ~ '^\s*\{';
