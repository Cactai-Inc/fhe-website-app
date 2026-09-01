-- SELECT-OR-OTHER infrastructure. Nearly no field should be free-text only: each
-- controllable field is a dropdown of known options + an "Other" escape that reveals
-- a free-text box. What people type into "Other" is captured here so the barn can
-- periodically review frequent entries and promote them into the official list.

-- 1. the capture queue -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lookup_suggestions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lookup_key   text NOT NULL,                 -- which vocabulary: 'horse_breeds','horse_colors','horse_markings',…
  raw_value    text NOT NULL,                 -- exactly what the user typed
  norm_value   text NOT NULL,                 -- lower(trim(raw)) for de-dup counting
  count        integer NOT NULL DEFAULT 1,    -- how many times this value has been entered
  status       text NOT NULL DEFAULT 'open',  -- open | promoted | dismissed
  org_id       uuid,
  first_seen   timestamptz NOT NULL DEFAULT now(),
  last_seen    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lookup_key, norm_value)
);
ALTER TABLE public.lookup_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lookup_suggestions_admin ON public.lookup_suggestions;
CREATE POLICY lookup_suggestions_admin ON public.lookup_suggestions FOR ALL USING (is_admin()) WITH CHECK (is_admin());
GRANT SELECT, INSERT, UPDATE ON public.lookup_suggestions TO authenticated;

-- 2. capture RPC — called whenever a user picks "Other" and types a value. Any
--    authenticated user may contribute a suggestion (SECURITY DEFINER bypasses the
--    admin-only RLS for this controlled upsert). De-dupes case-insensitively and
--    bumps the count; skips values that already exist as an official option.
CREATE OR REPLACE FUNCTION public.record_lookup_suggestion(p_lookup_key text, p_raw_value text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_norm text; v_exists boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  v_norm := lower(btrim(coalesce(p_raw_value,'')));
  IF v_norm = '' THEN RETURN; END IF;

  -- if the value already matches an official option in a known table, don't queue it
  IF p_lookup_key = 'horse_breeds' THEN
    SELECT EXISTS(SELECT 1 FROM horse_breeds WHERE active AND lower(display_name)=v_norm) INTO v_exists;
  ELSIF p_lookup_key = 'horse_colors' THEN
    SELECT EXISTS(SELECT 1 FROM horse_colors WHERE active AND lower(display_name)=v_norm) INTO v_exists;
  ELSE
    SELECT EXISTS(SELECT 1 FROM lookup_options WHERE lookup_key=p_lookup_key AND active AND lower(display_name)=v_norm) INTO v_exists;
  END IF;
  IF v_exists THEN RETURN; END IF;

  INSERT INTO lookup_suggestions (lookup_key, raw_value, norm_value, org_id)
  VALUES (p_lookup_key, btrim(p_raw_value), v_norm, current_org())
  ON CONFLICT (lookup_key, norm_value)
  DO UPDATE SET count = lookup_suggestions.count + 1, last_seen = now(),
                raw_value = EXCLUDED.raw_value;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.record_lookup_suggestion(text, text) TO authenticated;

-- 3. a GENERIC lookup table so new vocabularies don't each need their own table.
--    (horse_breeds/horse_colors keep their dedicated tables; everything new lives here.)
CREATE TABLE IF NOT EXISTS public.lookup_options (
  lookup_key   text NOT NULL,
  code         text NOT NULL,
  display_name text NOT NULL,
  active       boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 100,
  PRIMARY KEY (lookup_key, code)
);
ALTER TABLE public.lookup_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lookup_options_read ON public.lookup_options;
CREATE POLICY lookup_options_read ON public.lookup_options FOR SELECT USING (true);
DROP POLICY IF EXISTS lookup_options_admin ON public.lookup_options;
CREATE POLICY lookup_options_admin ON public.lookup_options FOR ALL USING (is_admin()) WITH CHECK (is_admin());
GRANT SELECT ON public.lookup_options TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.lookup_options TO authenticated;

-- 4. promote a suggestion into an official option (admin action).
CREATE OR REPLACE FUNCTION public.promote_lookup_suggestion(p_id uuid, p_code text DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_s lookup_suggestions%ROWTYPE; v_code text;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT * INTO v_s FROM lookup_suggestions WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown suggestion'; END IF;
  v_code := coalesce(nullif(p_code,''), upper(regexp_replace(v_s.raw_value, '[^a-zA-Z0-9]+', '_', 'g')));

  IF v_s.lookup_key = 'horse_breeds' THEN
    INSERT INTO horse_breeds (code, display_name, active, sort_order)
      VALUES (v_code, v_s.raw_value, true, 900) ON CONFLICT (code) DO UPDATE SET active=true;
  ELSIF v_s.lookup_key = 'horse_colors' THEN
    INSERT INTO horse_colors (code, display_name, active, sort_order)
      VALUES (v_code, v_s.raw_value, true, 900) ON CONFLICT (code) DO UPDATE SET active=true;
  ELSE
    INSERT INTO lookup_options (lookup_key, code, display_name, active, sort_order)
      VALUES (v_s.lookup_key, v_code, v_s.raw_value, true, 900)
      ON CONFLICT (lookup_key, code) DO UPDATE SET active=true;
  END IF;

  UPDATE lookup_suggestions SET status='promoted' WHERE id = p_id;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.promote_lookup_suggestion(uuid, text) TO authenticated;
