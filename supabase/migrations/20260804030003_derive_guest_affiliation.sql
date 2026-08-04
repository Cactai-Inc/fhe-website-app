-- derive_affiliations: the general (visitor) release derives GUEST, so the
-- category a visitor's documents belong to actually exists. 2026-08-04.
CREATE OR REPLACE FUNCTION public.derive_affiliations(p_contact_id uuid)
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH ex AS (
    SELECT bool_or(t.template_key = 'RELEASE_PARTICIPANT') AS sig_rider,
           bool_or(t.template_key = 'RELEASE_HORSE_CARE')  AS sig_care,
           bool_or(t.template_key = 'HORSE_EMERGENCY_VET') AS sig_vet,
           bool_or(t.template_key = 'RELEASE_GENERAL')      AS sig_guest
      FROM documents d
      JOIN contract_templates t ON t.id = d.template_id
     WHERE d.contact_id = p_contact_id AND d.status = 'EXECUTED' AND d.deleted_at IS NULL
  )
  SELECT (
    SELECT array_agg(g ORDER BY g) FROM (
      -- GUEST: the visitor release is the affiliation (2026-08-04). Without
      -- this, signing the general release granted NO affiliation at all, so a
      -- visitor had documents on file and no category to hang them on. It is
      -- additive: a guest who later signs a participant release simply gains
      -- RIDER alongside it.
      SELECT 'GUEST'::text AS g WHERE (SELECT sig_guest FROM ex)
      UNION
      SELECT 'RIDER'::text AS g WHERE (SELECT sig_rider FROM ex)
      UNION
      SELECT 'HORSE_OWNER' WHERE (SELECT (sig_care AND sig_vet) FROM ex)
         OR EXISTS (SELECT 1 FROM horses h WHERE h.current_owner_contact_id = p_contact_id AND h.deleted_at IS NULL)
      UNION
      SELECT 'PARENT_GUARDIAN' WHERE EXISTS (
        SELECT 1 FROM document_parties dp
         WHERE dp.contact_id = p_contact_id AND dp.party_role = 'GUARDIAN')
    ) s
  );
$function$

;
