/*
  # Party picker fixes — FHE label + "Other (specify)" escape

  Two composition fixes for the responsibility party picker:
  1. party_label('FHE') returned '' (unhandled) — care-responsibility fields
     (Owner/Lessee/FHE/Shared) composed FHE to nothing. Add FHE.
  2. The "Other (please specify)" escape ELS gives every allocation now writes
     party='OTHER' + a free-text note; compose_field_prose must emit that note.
*/

-- 1. FHE label
CREATE OR REPLACE FUNCTION public.party_label(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE upper(coalesce(p,''))
    WHEN 'OWNER'  THEN 'the Owner'   WHEN 'LESSOR' THEN 'the Lessor'
    WHEN 'LESSEE' THEN 'the Lessee'  WHEN 'BUYER'  THEN 'the Buyer'
    WHEN 'SELLER' THEN 'the Seller'  WHEN 'CLIENT' THEN 'the Client'
    WHEN 'FHE'    THEN 'French Heritage Equestrian'
    WHEN 'CARE_PROVIDER' THEN 'the Care Provider'
    WHEN 'SHARED' THEN 'the parties jointly'
    ELSE '' END;
$fn$;

-- 2. "Other" branch in the party composer (targeted ASCII-safe insert).
DO $patch$
DECLARE v_def text; v_new text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc WHERE proname='compose_field_prose';
  v_new := replace(v_def,
    E'      ELSIF v_party = ''SHARED'' THEN\n        v_out := compose_field_prose(''percent_split'', s, p_label, NULL);',
    E'      ELSIF v_party = ''OTHER'' THEN\n'
    || E'        v_out := coalesce(nullif(s->>''note'',''''), needs(coalesce(p_label,''arrangement'')));\n'
    || E'      ELSIF v_party = ''SHARED'' THEN\n        v_out := compose_field_prose(''percent_split'', s, p_label, NULL);'
  );
  IF v_new = v_def THEN RAISE EXCEPTION 'party SHARED branch not found in compose_field_prose'; END IF;
  EXECUTE v_new;
END $patch$;
