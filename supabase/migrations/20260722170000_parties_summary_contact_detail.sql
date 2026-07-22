-- Parties & Horse summary: return each party's full contact detail (address,
-- phone, email) plus per-field "have it / missing it" flags, and the horse's
-- identity completeness. Powers the top-of-contract card (which showed only names)
-- and the reusable capture-missing-info modal.
--
-- "Required" for a lease party = name + address + email + phone (owner directive
-- 2026-07-22). We report presence per field so the UI can show the value or an
-- "Add" affordance, and compute a per-party `complete` flag used to gate signing.

CREATE OR REPLACE FUNCTION public.document_parties_summary(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_horse uuid;
BEGIN
  SELECT org_id, horse_id INTO v_org, v_horse FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org()) OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN jsonb_build_object(
    'parties', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'party_role', dp.party_role,
          'contact_id', dp.contact_id,
          'name',  nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''),
          'email', nullif(btrim(coalesce(c.email,'')), ''),
          'phone', nullif(btrim(coalesce(c.phone,'')), ''),
          'address', nullif(btrim(coalesce(
                       nullif(btrim(coalesce(c.address_composed,'')),''),
                       compose_address(c.address_line1, c.address_line2, c.city, c.state, c.postal_code)
                     ,'')), ''),
          -- component fields so the modal can edit the address in parts
          'address_line1', c.address_line1, 'address_line2', c.address_line2,
          'city', c.city, 'state', c.state, 'postal_code', c.postal_code,
          'first_name', c.first_name, 'last_name', c.last_name,
          -- required-field completeness (name+address+email+phone)
          'missing', (
            SELECT coalesce(jsonb_agg(m), '[]'::jsonb) FROM (
              SELECT 'name'    AS m WHERE nullif(btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')),'') IS NULL
              UNION ALL SELECT 'email'   WHERE nullif(btrim(coalesce(c.email,'')),'') IS NULL
              UNION ALL SELECT 'phone'   WHERE nullif(btrim(coalesce(c.phone,'')),'') IS NULL
              UNION ALL SELECT 'address' WHERE nullif(btrim(coalesce(
                         nullif(btrim(coalesce(c.address_composed,'')),''),
                         compose_address(c.address_line1,c.address_line2,c.city,c.state,c.postal_code)
                       ,'')),'') IS NULL
            ) q
          ))
        ORDER BY dp.party_role)
      FROM document_parties dp
      LEFT JOIN contacts c ON c.id = dp.contact_id
      WHERE dp.document_id = p_document_id
        AND dp.party_role IN ('LESSEE','LESSOR','BUYER','SELLER')), '[]'::jsonb),
    'horse_id', v_horse,
    'horse_name', (SELECT coalesce(nullif(registered_name,''), nickname) FROM horses WHERE id = v_horse),
    'horse_missing', CASE WHEN v_horse IS NULL THEN jsonb_build_array('horse')
      ELSE coalesce((SELECT jsonb_agg(m) FROM (
        SELECT 'identity' AS m FROM horses h WHERE h.id = v_horse
         AND nullif(btrim(coalesce(h.registered_name,'')),'') IS NULL
         AND nullif(btrim(coalesce(h.nickname,'')),'') IS NULL
      ) q), '[]'::jsonb) END
  );
END;
$function$;
