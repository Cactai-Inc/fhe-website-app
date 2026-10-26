-- Fix round 3, item 7 — the field permission check lets BUYER and COBUYER edit
-- each other's deal fields, but NOT each other's per-person initials or signer
-- fields.
--
-- A co-buyer is a second BUYER party row (party_role 'BUYER'), so they already own
-- BUYER-owned fields. What they could NOT reach was a COBUYER-owned field. This
-- broadens v_owns_role so a BUYER-party caller owns a COBUYER-owned field (and vice
-- versa) EXCEPT when the field is a per-person initials (format_type='initials') or
-- signer field (*.ENTITY_SIGNER_*), which stays with its exact owner role.
--
-- In-place: rewrite the v_owns_role assignment only. v_format is already populated
-- (the money-shape check reads format_type into it just above), so it is available
-- here. The rest of set_contract_field is untouched.

BEGIN;

DO $mig$
DECLARE
  v_src text := pg_get_functiondef('public.set_contract_field(uuid,text,text)'::regprocedure);
  v_own_old text := 'v_owns_role := EXISTS (SELECT 1 FROM caller_party_roles(p_document_id) r WHERE r = v_owner_role);';
  v_own_new text := 'v_owns_role := EXISTS (SELECT 1 FROM caller_party_roles(p_document_id) r
    WHERE r = v_owner_role
       -- fix round 3, item 7: BUYER and COBUYER edit each other''s DEAL fields,
       -- but a per-person initials (format_type=''initials'') or signer field
       -- (*.ENTITY_SIGNER_*) stays with its exact owner.
       OR (v_owner_role IN (''BUYER'',''COBUYER'') AND r IN (''BUYER'',''COBUYER'')
           AND coalesce(v_format, '''') <> ''initials''
           AND p_field_key NOT LIKE ''%.ENTITY_SIGNER_%''));';
BEGIN
  IF position(v_own_old in v_src) = 0 THEN RAISE EXCEPTION 'set_contract_field v_owns_role anchor not found'; END IF;
  v_src := replace(v_src, v_own_old, v_own_new);
  EXECUTE v_src;
END $mig$;

COMMIT;
