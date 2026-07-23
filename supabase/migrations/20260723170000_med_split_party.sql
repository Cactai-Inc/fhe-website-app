-- Medications & supplements: split the single "responsible party" into three —
-- administering, ordering, and cost — since they aren't always the same party
-- (a vet may administer but rarely bears the cost or does the ordering).
--
-- compose_med_schedule now renders each present role. Back-compat: an item that
-- only has the legacy single `party` still renders as "(responsible: …)".

-- small helper: a party value + OTHER note → its display label (defined first so
-- compose_med_schedule can call it).
CREATE OR REPLACE FUNCTION public.med_party_who(p_party text, p_note text)
 RETURNS text LANGUAGE sql IMMUTABLE AS $function$
  SELECT CASE WHEN upper(coalesce(p_party,'')) = 'OTHER'
              THEN coalesce(nullif(btrim(p_note),''), 'Other')
              ELSE party_label(p_party) END;
$function$;

CREATE OR REPLACE FUNCTION public.compose_med_schedule(p_structured jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE it jsonb; lines text[] := ARRAY[]::text[]; part text; roles text[];
BEGIN
  IF p_structured IS NULL OR coalesce(jsonb_array_length(p_structured->'medItems'),0) = 0 THEN
    RETURN needs('medications and supplements');
  END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(p_structured->'medItems') LOOP
    part := btrim(coalesce(it->>'name',''));
    IF coalesce(nullif(btrim(it->>'dose'),''),'') <> '' THEN part := part || ' — ' || btrim(it->>'dose'); END IF;
    IF coalesce(nullif(btrim(it->>'schedule'),''),'') <> '' THEN part := part || ', ' || btrim(it->>'schedule'); END IF;

    roles := ARRAY[]::text[];
    -- administering / ordering / cost, each shown only when set
    IF coalesce(nullif(btrim(it->>'administer_party'),''),'') <> '' THEN
      roles := roles || ('administered by ' || med_party_who(it->>'administer_party', it->>'administer_note'));
    END IF;
    IF coalesce(nullif(btrim(it->>'order_party'),''),'') <> '' THEN
      roles := roles || ('ordered by ' || med_party_who(it->>'order_party', it->>'order_note'));
    END IF;
    IF coalesce(nullif(btrim(it->>'cost_party'),''),'') <> '' THEN
      roles := roles || ('cost paid by ' || med_party_who(it->>'cost_party', it->>'cost_note'));
    END IF;

    IF coalesce(array_length(roles,1),0) > 0 THEN
      part := part || ' (' || array_to_string(roles, '; ') || ')';
    ELSIF coalesce(nullif(btrim(it->>'party'),''),'') <> '' THEN
      -- legacy single-party fallback
      part := part || ' (responsible: ' || med_party_who(it->>'party', it->>'party_note') || ')';
    END IF;

    IF btrim(part) <> '' THEN lines := lines || part; END IF;
  END LOOP;
  RETURN array_to_string(lines, E'\n');
END;
$function$;

-- update the field guidance to reflect the three roles
UPDATE contract_field_defs
   SET guidance = 'Add each medication or supplement with its dose and schedule, and set the party responsible for administering, for ordering, and for its cost (each can be a different party).'
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.MEDICATIONS';
