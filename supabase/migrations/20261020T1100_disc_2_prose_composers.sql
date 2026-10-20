-- Disclosure reciprocity, phase 2: one prose composer per section, turning the
-- record's structured list into the contract disclosure text. Description is the
-- spine of every entry; other fields append only when present (optional).
-- Each entry composes to one line; entries join with a blank line between them.

-- Known conditions: description [first noticed <date>] [status] [triggers: ...] [accommodations: ...]
CREATE OR REPLACE FUNCTION public.horse_conditions_prose(p_list jsonb)
 RETURNS text LANGUAGE sql IMMUTABLE AS $function$
  SELECT nullif(string_agg(nullif(btrim(concat_ws(' ',
    nullif(btrim(e->>'description'),''),
    CASE WHEN nullif(btrim(e->>'date_first_noticed'),'') IS NOT NULL THEN '(first noticed ' || btrim(e->>'date_first_noticed') || ')' END,
    CASE WHEN nullif(btrim(e->>'status'),'') IS NOT NULL THEN '— ' || btrim(e->>'status') END,
    CASE WHEN nullif(btrim(e->>'triggers'),'') IS NOT NULL THEN '| triggers: ' || btrim(e->>'triggers') END,
    CASE WHEN nullif(btrim(e->>'accommodations'),'') IS NOT NULL THEN '| accommodations: ' || btrim(e->>'accommodations') END
  )),''), E'\n'), '')
  FROM jsonb_array_elements(coalesce(p_list,'[]'::jsonb)) e;
$function$;

-- Medical history: [<date>] type: description — status
CREATE OR REPLACE FUNCTION public.horse_medical_prose(p_list jsonb)
 RETURNS text LANGUAGE sql IMMUTABLE AS $function$
  SELECT nullif(string_agg(nullif(btrim(concat_ws(' ',
    CASE WHEN nullif(btrim(e->>'date'),'') IS NOT NULL THEN btrim(e->>'date') || ':' END,
    CASE WHEN nullif(btrim(e->>'type'),'') IS NOT NULL THEN btrim(e->>'type') || ' —' END,
    nullif(btrim(e->>'description'),''),
    CASE WHEN nullif(btrim(e->>'status'),'') IS NOT NULL THEN '(' || btrim(e->>'status') || ')' END
  )),''), E'\n'), '')
  FROM jsonb_array_elements(coalesce(p_list,'[]'::jsonb)) e;
$function$;

-- Behavior: description [trigger: ...] [since <date>]
CREATE OR REPLACE FUNCTION public.horse_behavior_prose(p_list jsonb)
 RETURNS text LANGUAGE sql IMMUTABLE AS $function$
  SELECT nullif(string_agg(nullif(btrim(concat_ws(' ',
    nullif(btrim(e->>'description'),''),
    CASE WHEN nullif(btrim(e->>'trigger'),'') IS NOT NULL THEN '| trigger: ' || btrim(e->>'trigger') END,
    CASE WHEN nullif(btrim(e->>'date_since'),'') IS NOT NULL THEN '(since ' || btrim(e->>'date_since') || ')' END
  )),''), E'\n'), '')
  FROM jsonb_array_elements(coalesce(p_list,'[]'::jsonb)) e;
$function$;

-- Injuries to humans: [<date>] [riding/not riding] description — outcome
CREATE OR REPLACE FUNCTION public.horse_injuries_humans_prose(p_list jsonb)
 RETURNS text LANGUAGE sql IMMUTABLE AS $function$
  SELECT nullif(string_agg(nullif(btrim(concat_ws(' ',
    CASE WHEN nullif(btrim(e->>'date'),'') IS NOT NULL THEN btrim(e->>'date') || ':' END,
    CASE WHEN (e->>'was_riding') = 'true' THEN '(person was riding)'
         WHEN (e->>'was_riding') = 'false' THEN '(person was not riding)' END,
    nullif(btrim(e->>'description'),''),
    CASE WHEN nullif(btrim(e->>'outcome'),'') IS NOT NULL THEN '— ' || btrim(e->>'outcome') END
  )),''), E'\n'), '')
  FROM jsonb_array_elements(coalesce(p_list,'[]'::jsonb)) e;
$function$;

-- Injuries to the horse: [<date/range>] description [rider involved] [human hurt (riding?)] — outcome — status
CREATE OR REPLACE FUNCTION public.horse_injuries_horse_prose(p_list jsonb)
 RETURNS text LANGUAGE sql IMMUTABLE AS $function$
  SELECT nullif(string_agg(nullif(btrim(concat_ws(' ',
    CASE WHEN nullif(btrim(e->>'date'),'') IS NOT NULL THEN btrim(e->>'date') || ':' END,
    nullif(btrim(e->>'description'),''),
    CASE WHEN (e->>'rider_involved') = 'true' THEN '| a rider was involved' END,
    CASE WHEN (e->>'human_hurt') = 'true' THEN '| a person was hurt'
          || CASE WHEN (e->>'human_was_riding') = 'true' THEN ' (riding)'
                  WHEN (e->>'human_was_riding') = 'false' THEN ' (not riding)' ELSE '' END END,
    CASE WHEN nullif(btrim(e->>'outcome'),'') IS NOT NULL THEN '— ' || btrim(e->>'outcome') END,
    CASE WHEN nullif(btrim(e->>'status'),'') IS NOT NULL THEN '(' || btrim(e->>'status') || ')' END
  )),''), E'\n'), '')
  FROM jsonb_array_elements(coalesce(p_list,'[]'::jsonb)) e;
$function$;

-- Medications / supplements prose incl. the conditions-of-use note (library-backed).
CREATE OR REPLACE FUNCTION public.horse_meds_prose_v2(p_horse uuid, p_kind text)
 RETURNS text LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  SELECT nullif(string_agg(nullif(btrim(concat_ws(' ',
    nullif(btrim(m.name),''),
    CASE WHEN nullif(btrim(m.dosage),'') IS NOT NULL THEN '— ' || btrim(m.dosage) END,
    CASE WHEN nullif(btrim(m.instructions),'') IS NOT NULL THEN '(' || btrim(m.instructions) || ')' END,
    CASE WHEN nullif(btrim(m.conditions_of_use),'') IS NOT NULL THEN '| conditions of use: ' || btrim(m.conditions_of_use) END
  )),''), E'\n' ORDER BY m.sort_order, m.name), '')
  FROM horse_medications m
  WHERE m.horse_id = p_horse AND m.kind = p_kind AND m.deleted_at IS NULL;
$function$;
