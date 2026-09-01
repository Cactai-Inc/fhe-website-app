-- STRUCTURED COMPOSERS — the structure is the source of truth; the legal prose is
-- DERIVED. compose_field_prose(format_type, structured, label) turns a field's
-- structured jsonb into the prose string its {{TOKEN}} expects. Missing required
-- parts render as a visible fill-in blank ('_____') AND wrap the field in a
-- highlight marker so the body renderer can flag the gap:  ⟦NEEDS:label⟧prose⟧.
-- (The front-end turns ⟦NEEDS:…⟧…⟧ into a highlighted "needs input" span; plain
-- prose passes through untouched.)
--
-- party helper: PARTY codes → readable words.

CREATE OR REPLACE FUNCTION public.party_label(p text)
 RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE upper(coalesce(p,''))
    WHEN 'OWNER'  THEN 'the Owner'   WHEN 'LESSOR' THEN 'the Lessor'
    WHEN 'LESSEE' THEN 'the Lessee'  WHEN 'BUYER'  THEN 'the Buyer'
    WHEN 'SELLER' THEN 'the Seller'  WHEN 'CLIENT' THEN 'the Client'
    WHEN 'CARE_PROVIDER' THEN 'the Care Provider'
    WHEN 'SHARED' THEN 'the parties jointly'
    ELSE '' END;
$$;

-- BLANK marker: a required-but-empty part. Wrapped so the UI highlights it.
CREATE OR REPLACE FUNCTION public.needs(p_label text)
 RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '⟦NEEDS:' || p_label || '⟧_____⟧';
$$;

CREATE OR REPLACE FUNCTION public.compose_field_prose(
  p_format text, p_structured jsonb, p_label text, p_value text DEFAULT NULL
)
 RETURNS text LANGUAGE plpgsql IMMUTABLE AS $function$
DECLARE
  s jsonb := coalesce(p_structured, '{}'::jsonb);
  v_out text;
  v_party text;
  v_prov jsonb;
  v_cost jsonb;
  v_manage jsonb;
  v_split jsonb;
  v_parts text[];
  v_e jsonb;
BEGIN
  -- No structure → fall back to the raw scalar value (hand-entered).
  IF p_structured IS NULL OR p_structured = '{}'::jsonb THEN
    RETURN coalesce(p_value, '');
  END IF;

  CASE p_format
    WHEN 'person' THEN
      v_parts := ARRAY[]::text[];
      IF coalesce(s->>'name','')  <> '' THEN v_parts := v_parts || (s->>'name'); END IF;
      IF coalesce(s->>'company','')<> '' THEN v_parts := v_parts || (s->>'company'); END IF;
      IF coalesce(s->>'phone','') <> '' THEN v_parts := v_parts || (s->>'phone'); END IF;
      IF coalesce(s->>'email','') <> '' THEN v_parts := v_parts || (s->>'email'); END IF;
      v_out := array_to_string(v_parts, ', ');
      IF v_out = '' THEN v_out := needs(coalesce(p_label,'contact')); END IF;

    WHEN 'address' THEN
      v_parts := ARRAY[]::text[];
      IF coalesce(s->>'line1','') <> '' THEN v_parts := v_parts || (s->>'line1'); END IF;
      IF coalesce(s->>'line2','') <> '' THEN v_parts := v_parts || (s->>'line2'); END IF;
      IF coalesce(s->>'city','')  <> '' OR coalesce(s->>'state','') <> '' OR coalesce(s->>'postal','') <> '' THEN
        v_parts := v_parts || btrim(concat_ws(' ', concat_ws(', ', nullif(s->>'city',''), nullif(s->>'state','')), nullif(s->>'postal','')));
      END IF;
      v_out := array_to_string(v_parts, ', ');
      IF v_out = '' THEN v_out := coalesce(p_value,''); END IF;

    WHEN 'location' THEN
      v_out := coalesce(nullif(s->>'text',''), p_value, '');

    WHEN 'currency' THEN
      v_out := coalesce(nullif(s->>'amount',''), p_value, '');
      IF v_out <> '' AND left(v_out,1) <> '$' THEN v_out := '$' || v_out; END IF;

    WHEN 'list' THEN
      IF jsonb_typeof(s->'items') = 'array' THEN
        SELECT string_agg(value, '; ') INTO v_out FROM jsonb_array_elements_text(s->'items') WHERE value <> '';
      END IF;
      v_out := coalesce(v_out, p_value, '');

    WHEN 'percent_split' THEN
      -- {parties:[{party,pct}], note}
      IF jsonb_typeof(s->'parties') = 'array' THEN
        SELECT string_agg(party_label(e->>'party') || ' ' || (e->>'pct') || '%', ', ')
          INTO v_out FROM jsonb_array_elements(s->'parties') e WHERE coalesce(e->>'pct','') <> '';
      END IF;
      v_out := coalesce(v_out, needs(coalesce(p_label,'split')));
      IF coalesce(s->>'note','') <> '' THEN v_out := v_out || ' (' || (s->>'note') || ')'; END IF;

    WHEN 'party' THEN
      v_party := s->>'party';
      IF coalesce(v_party,'') = '' THEN
        v_out := needs(coalesce(p_label,'responsible party'));
      ELSIF v_party = 'CARE_PROVIDER' THEN
        v_prov := s->'provider';
        v_out := party_label('CARE_PROVIDER');
        IF coalesce(v_prov->>'name','') <> '' THEN
          v_out := v_out || ' (' || compose_field_prose('person', v_prov, p_label, NULL) || ')';
        ELSE
          v_out := v_out || ' (' || needs('care provider contact') || ')';
        END IF;
      ELSIF v_party = 'SHARED' THEN
        v_out := compose_field_prose('percent_split', s, p_label, NULL);
      ELSE
        v_out := party_label(v_party);
      END IF;

    WHEN 'pair' THEN
      -- This composes the MANAGE half. The cost child token is composed separately
      -- (compose_pair_cost). manage = {party,provider,parties}; here we render party.
      v_manage := s->'manage';
      IF v_manage IS NULL THEN v_manage := s; END IF;   -- tolerate flat shape
      v_out := compose_field_prose('party', v_manage, p_label, NULL);

    ELSE
      -- scalar formats (text/longtext/phone/email/name/date/number/website/select/…):
      -- structure is {value:...} or {text:...}; fall back to raw value.
      v_out := coalesce(nullif(s->>'value',''), nullif(s->>'text',''), p_value, '');
  END CASE;

  RETURN coalesce(v_out, '');
END;
$function$;

-- compose the COST half of a pair, given the manage field's structured jsonb.
-- cost.same_as_manage (default true) → cost follows the managing party.
CREATE OR REPLACE FUNCTION public.compose_pair_cost(p_manage_structured jsonb, p_label text)
 RETURNS text LANGUAGE plpgsql IMMUTABLE AS $function$
DECLARE
  s jsonb := coalesce(p_manage_structured, '{}'::jsonb);
  v_cost jsonb := s->'cost';
  v_manage jsonb := coalesce(s->'manage', s);
BEGIN
  -- default (or explicit same_as_manage) → the managing party covers the cost
  IF v_cost IS NULL OR coalesce((v_cost->>'same_as_manage')::boolean, true) THEN
    IF coalesce(v_manage->>'party','') = '' THEN RETURN needs('who covers the cost'); END IF;
    RETURN 'borne by ' || party_label(v_manage->>'party');
  END IF;
  -- diverged: a specific party or a shared split
  IF coalesce(v_cost->>'party','') = 'SHARED' THEN
    RETURN 'shared — ' || compose_field_prose('percent_split', v_cost, p_label, NULL);
  ELSIF coalesce(v_cost->>'party','') <> '' THEN
    RETURN 'borne by ' || party_label(v_cost->>'party');
  END IF;
  RETURN needs('who covers the cost');
END;
$function$;

-- recompose every structured field's `value` from its `structured`, so the existing
-- token-substitution remerge picks up derived prose. Pair cost-children are composed
-- from their manage field's structure. Non-structured fields are left as-is.
CREATE OR REPLACE FUNCTION public.recompose_document_fields(p_document_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE r RECORD; v_manage jsonb;
BEGIN
  -- 1. every field that has structure → compose its own value
  FOR r IN SELECT field_key, format_type, structured, value, label, pair_manage_key
             FROM contract_fields WHERE document_id = p_document_id LOOP
    IF r.pair_manage_key IS NOT NULL THEN
      CONTINUE;  -- cost children handled in pass 2 (need the manage field's structure)
    END IF;
    IF r.structured IS NOT NULL AND r.structured <> '{}'::jsonb THEN
      UPDATE contract_fields
         SET value = compose_field_prose(r.format_type, r.structured, r.label, r.value),
             updated_at = now()
       WHERE document_id = p_document_id AND field_key = r.field_key;
    END IF;
  END LOOP;

  -- 2. pair cost children → compose from the manage field's structure
  FOR r IN SELECT c.field_key, c.label, m.structured AS manage_structured
             FROM contract_fields c
             JOIN contract_fields m ON m.document_id = c.document_id AND m.field_key = c.pair_manage_key
            WHERE c.document_id = p_document_id AND c.pair_manage_key IS NOT NULL LOOP
    IF r.manage_structured IS NOT NULL AND r.manage_structured <> '{}'::jsonb THEN
      UPDATE contract_fields
         SET value = compose_pair_cost(r.manage_structured, r.label), updated_at = now()
       WHERE document_id = p_document_id AND field_key = r.field_key;
    END IF;
  END LOOP;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.recompose_document_fields(uuid) TO authenticated;
