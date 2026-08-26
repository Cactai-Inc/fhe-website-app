-- EVERY MENU IN THE APP, IN ONE PLACE, EDITABLE (owner, 2026-08-25).
--
-- > *"i need a way to see and edit all of the menu contents throughout the app,
-- >  i have a form editor but the only thing it lets me do is toggle on and off
-- >  whether a field is required."*
--
-- ⚠️ THERE ARE TWO MENU SYSTEMS, AND THE SMALL ONE IS THE ONE THAT HAD A PAGE.
--   · VOCABULARIES — `horse_breeds` (16), `horse_colors` (14) and three keys in
--     `lookup_options` (markings 9, registration org 13, passport country 11).
--     Five menus. `/app/ops/lookups` exists, but it only shows the SUGGESTION
--     QUEUE — values people typed under "Other" — never the lists themselves.
--   · FORM OPTIONS — `form_definitions.schema` → sections → fields → `options`.
--     **119 option lists across all 28 forms.** These had no editor at all.
-- So "all the menu contents" is ~124 lists, and 119 of them were invisible. An
-- editor covering only the vocabularies would have missed 96% of them.
--
-- WHAT IS DELIBERATELY NOT HERE: adding, removing or renaming a form FIELD.
-- A field's `key` is what stored answers are filed under, so renaming or removing
-- one orphans real submitted data — that needs a decision about what happens to
-- existing answers, not a text box. Editing a field's OPTIONS touches no key and
-- orphans nothing, which is why it is safe to ship now.

BEGIN;

/** Every menu in the app, both kinds, with where it is used. */
CREATE OR REPLACE FUNCTION public.menu_inventory()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(m ORDER BY m->>'label'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
             'source', 'vocabulary', 'menu_key', k.key, 'label', k.label,
             'used_by', k.used_by,
             'total', k.total, 'active', k.active) AS m
      FROM (
        SELECT 'horse_breeds' AS key, 'Horse breed' AS label,
               'Horse records · horse intake · contracts' AS used_by,
               count(*) AS total, count(*) FILTER (WHERE active) AS active
          FROM horse_breeds
        UNION ALL
        SELECT 'horse_colors', 'Horse color', 'Horse records · horse intake · contracts',
               count(*), count(*) FILTER (WHERE active) FROM horse_colors
        UNION ALL
        SELECT lo.lookup_key,
               initcap(replace(replace(lo.lookup_key, 'horse_', 'Horse '), '_', ' ')),
               'Horse intake · contracts',
               count(*), count(*) FILTER (WHERE lo.active)
          FROM lookup_options lo GROUP BY lo.lookup_key
      ) k
    UNION ALL
    SELECT jsonb_build_object(
             'source', 'form', 'menu_key', fd.form_key || '::' || (f->>'key'),
             'label', (f->>'label'), 'form_key', fd.form_key, 'field_key', (f->>'key'),
             'used_by', fd.title,
             'total', jsonb_array_length(f->'options'),
             'active', jsonb_array_length(f->'options'))
      FROM form_definitions fd,
           LATERAL jsonb_array_elements(fd.schema->'sections') s,
           LATERAL jsonb_array_elements(s->'fields') f
     WHERE fd.active AND f ? 'options'
  ) all_menus;
$function$;

/** One vocabulary's values, INCLUDING the switched-off ones — an editor that
 *  cannot see what it turned off cannot turn it back on. */
CREATE OR REPLACE FUNCTION public.menu_vocabulary_values(p_key text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admin only'; END IF;
  IF p_key = 'horse_breeds' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('code', code, 'display_name', display_name,
             'active', active) ORDER BY display_name), '[]'::jsonb) INTO v FROM horse_breeds;
  ELSIF p_key = 'horse_colors' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('code', code, 'display_name', display_name,
             'active', active) ORDER BY display_name), '[]'::jsonb) INTO v FROM horse_colors;
  ELSE
    SELECT coalesce(jsonb_agg(jsonb_build_object('code', code, 'display_name', display_name,
             'active', active) ORDER BY display_name), '[]'::jsonb) INTO v
      FROM lookup_options WHERE lookup_key = p_key;
  END IF;
  RETURN v;
END;
$function$;

/**
 * Rename a menu value, or switch it on/off.
 *
 * ⚠️ THE CODE IS NEVER CHANGED HERE, ONLY THE DISPLAY NAME. `horses.breed` and
 * `horses.color` are foreign keys to `code`, and the code is also what a saved
 * record already holds — so renaming "Halfinger" to "Haflinger" must move the
 * WORDS and leave every record pointing where it points. (The 2026-08-25 spelling
 * fix changed a code too, but only because it could ride the FK's ON UPDATE
 * CASCADE inside one migration; a UI must not offer that.)
 *
 * Switching OFF is how a value is removed: it disappears from every dropdown and
 * stays valid on the records that already carry it. Deleting outright would break
 * those records, so it is not offered.
 */
CREATE OR REPLACE FUNCTION public.set_menu_value(
  p_key text, p_code text, p_display_name text DEFAULT NULL, p_active boolean DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_name text := nullif(btrim(coalesce(p_display_name, '')), '');
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admin only'; END IF;
  IF p_display_name IS NOT NULL AND v_name IS NULL THEN
    RAISE EXCEPTION 'a menu value needs a name';
  END IF;

  IF p_key = 'horse_breeds' THEN
    UPDATE horse_breeds SET display_name = coalesce(v_name, display_name),
                            active = coalesce(p_active, active) WHERE code = p_code;
  ELSIF p_key = 'horse_colors' THEN
    UPDATE horse_colors SET display_name = coalesce(v_name, display_name),
                            active = coalesce(p_active, active) WHERE code = p_code;
  ELSE
    UPDATE lookup_options SET display_name = coalesce(v_name, display_name),
                              active = coalesce(p_active, active)
     WHERE lookup_key = p_key AND code = p_code;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'no value % in menu %', p_code, p_key; END IF;
END;
$function$;

/**
 * Replace one form field's option list.
 *
 * Rewrites `options` in place inside the schema and leaves every `key`, `label`,
 * `type` and `required` flag exactly as it found them — so no stored answer is
 * orphaned and the required-toggles page keeps working on the same document.
 * `version` is bumped, as `set_form_required` does, so the change is visible in
 * the row's own history.
 */
CREATE OR REPLACE FUNCTION public.set_form_field_options(
  p_form_key text, p_field_key text, p_options text[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_schema jsonb; v_new jsonb;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admin only'; END IF;
  IF p_options IS NULL OR array_length(p_options, 1) IS NULL THEN
    RAISE EXCEPTION 'a menu needs at least one option';
  END IF;

  SELECT schema INTO v_schema FROM form_definitions WHERE form_key = p_form_key;
  IF v_schema IS NULL THEN RAISE EXCEPTION 'unknown form %', p_form_key; END IF;

  SELECT jsonb_build_object('sections', jsonb_agg(sec ORDER BY sec_i)) INTO v_new
    FROM (
      SELECT sec_i,
             jsonb_set(s, '{fields}', (
               SELECT jsonb_agg(
                        CASE WHEN f->>'key' = p_field_key AND f ? 'options'
                             THEN jsonb_set(f, '{options}', to_jsonb(p_options))
                             ELSE f END
                        ORDER BY f_i)
                 FROM jsonb_array_elements(s->'fields') WITH ORDINALITY AS t(f, f_i)
             )) AS sec
        FROM jsonb_array_elements(v_schema->'sections') WITH ORDINALITY AS q(s, sec_i)
    ) x;

  UPDATE form_definitions
     SET schema = v_new, version = version + 1, updated_at = now()
   WHERE form_key = p_form_key;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.menu_inventory() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.menu_vocabulary_values(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_menu_value(text, text, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_form_field_options(text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.menu_inventory() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.menu_vocabulary_values(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_menu_value(text, text, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_form_field_options(text, text, text[]) TO authenticated, service_role;

COMMIT;
