-- Horse records overhaul, phase 3a: helper functions the token resolvers share, so
-- contract vet/farrier/location/narrative values come from the new structures.

-- The contract-facing value for a provider type: the active entry marked primary,
-- else the most recently added active entry. p_part: NAME | PHONE | BUSINESS | ADDRESS.
CREATE OR REPLACE FUNCTION public.horse_provider_value(p_horse uuid, p_type text, p_part text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE p_part
    WHEN 'NAME'     THEN coalesce(nullif(btrim(r.party_name_text), ''),
                                  (SELECT nullif(btrim(c.first_name||' '||c.last_name),'') FROM contacts c WHERE c.id = r.party_contact_id))
    WHEN 'PHONE'    THEN r.phone
    WHEN 'BUSINESS' THEN r.business_name
    WHEN 'ADDRESS'  THEN nullif(btrim(concat_ws(', ', r.address_line1, r.city,
                            nullif(btrim(concat_ws(' ', r.state, r.postal)),''))), '')
    ELSE NULL END
  FROM horse_relationships r
  WHERE r.horse_id = p_horse AND r.relationship = p_type AND r.active
  ORDER BY (r.provider_role = 'primary') DESC, r.created_at DESC
  LIMIT 1;
$function$;
REVOKE EXECUTE ON FUNCTION public.horse_provider_value(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.horse_provider_value(uuid, text, text) TO anon, authenticated, service_role;

-- The horse's current location (the open horse_locations row), composed as a label.
CREATE OR REPLACE FUNCTION public.horse_current_location_label(p_horse uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT nullif(btrim(concat_ws(', ', hl.name, hl.address_line1, hl.city,
            nullif(btrim(concat_ws(' ', hl.state, hl.postal)),''))), '')
  FROM horse_locations hl
  WHERE hl.horse_id = p_horse AND hl.end_on IS NULL
  ORDER BY hl.created_at DESC
  LIMIT 1;
$function$;
REVOKE EXECUTE ON FUNCTION public.horse_current_location_label(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.horse_current_location_label(uuid) TO anon, authenticated, service_role;

-- A narrative list (jsonb array of objects) composed to prose: the chosen text key
-- of each entry, joined with "; ". Used for the history/conditions contract tokens.
CREATE OR REPLACE FUNCTION public.horse_list_prose(p_list jsonb, p_key text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT nullif(string_agg(nullif(btrim(e ->> p_key), ''), '; '), '')
  FROM jsonb_array_elements(coalesce(p_list, '[]'::jsonb)) e;
$function$;

-- Injuries-to-humans composed to a disclosure sentence per entry.
CREATE OR REPLACE FUNCTION public.horse_injuries_prose(p_list jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT nullif(string_agg(
    nullif(btrim(concat_ws(' ',
      nullif(btrim(e ->> 'date'), ''),
      CASE WHEN nullif(btrim(e ->> 'person_type'), '') IS NOT NULL
           THEN '(' || btrim(e ->> 'person_type') || ')' END,
      nullif(btrim(e ->> 'description'), ''),
      CASE WHEN nullif(btrim(e ->> 'outcome'), '') IS NOT NULL
           THEN '— ' || btrim(e ->> 'outcome') END)), ''),
    '; '), '')
  FROM jsonb_array_elements(coalesce(p_list, '[]'::jsonb)) e;
$function$;
