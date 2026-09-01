-- Make the staff contract-free lease-assignment path internally consistent
-- (audit LOW finding). staff_assign_horse_party sets horses.lessee_contact_id +
-- lease_start/end with NO contract, but lease_sublease_allowed() reads ONLY an
-- executed HORSE_LEASE doc's TXN.SUBLEASE_ALLOWED — so a staff-assigned lessee
-- can never sublease even when staff intended to permit it.
--
-- Fix: a horses.sublease_allowed column as an explicit fallback. lease_sublease_
-- allowed() returns true when EITHER an executed lease permits it OR the column is
-- set. staff_assign_horse_party gains a p_sublease_allowed flag to set it.

ALTER TABLE horses ADD COLUMN IF NOT EXISTS sublease_allowed boolean NOT NULL DEFAULT false;

-- lease_sublease_allowed: executed-doc permission OR the horse column.
CREATE OR REPLACE FUNCTION public.lease_sublease_allowed(p_horse_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    coalesce((SELECT sublease_allowed FROM horses WHERE id = p_horse_id), false)
    OR coalesce((
      SELECT lower(btrim(cf.value)) IN ('true','yes','1','checked','on')
      FROM documents dc
      JOIN contract_templates t ON t.id = dc.template_id
      JOIN contract_fields cf ON cf.document_id = dc.id AND cf.field_key = 'TXN.SUBLEASE_ALLOWED'
      WHERE dc.horse_id = p_horse_id AND t.template_key = 'HORSE_LEASE'
        AND dc.status = 'EXECUTED' AND dc.deleted_at IS NULL
      ORDER BY dc.effective_date DESC NULLS LAST, dc.created_at DESC
      LIMIT 1
    ), false)
$function$;

-- staff_assign_horse_party gains p_sublease_allowed (drop old 5-arg sig first to avoid overload)
DROP FUNCTION IF EXISTS public.staff_assign_horse_party(uuid, text, uuid, date, date);
CREATE OR REPLACE FUNCTION public.staff_assign_horse_party(p_horse_id uuid, p_role text, p_contact_id uuid, p_term_start date DEFAULT NULL::date, p_term_end date DEFAULT NULL::date, p_sublease_allowed boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  IF p_role NOT IN ('OWNER','LESSEE') THEN
    RAISE EXCEPTION 'role must be OWNER or LESSEE';
  END IF;

  IF p_role = 'OWNER' THEN
    UPDATE horse_relationships SET active = false, ended_at = now()
     WHERE horse_id = p_horse_id AND relationship = 'OWNER' AND active
       AND (p_contact_id IS NULL OR party_contact_id IS DISTINCT FROM p_contact_id);
    UPDATE horses SET current_owner_contact_id = p_contact_id, updated_at = now()
     WHERE id = p_horse_id AND org_id = v_org;
  ELSE
    UPDATE horse_relationships SET active = false, ended_at = now()
     WHERE horse_id = p_horse_id AND relationship = 'LESSEE' AND active
       AND (p_contact_id IS NULL OR party_contact_id IS DISTINCT FROM p_contact_id);
    UPDATE horses
       SET lessee_contact_id = p_contact_id,
           lease_start = CASE WHEN p_contact_id IS NULL THEN NULL ELSE coalesce(p_term_start, lease_start) END,
           lease_end   = CASE WHEN p_contact_id IS NULL THEN NULL ELSE coalesce(p_term_end, lease_end) END,
           sublease_allowed = CASE WHEN p_contact_id IS NULL THEN false ELSE p_sublease_allowed END,
           updated_at = now()
     WHERE id = p_horse_id AND org_id = v_org;
  END IF;

  IF p_contact_id IS NOT NULL THEN
    INSERT INTO horse_relationships
      (org_id, horse_id, relationship, party_contact_id, term_start, term_end,
       created_by_contact_id)
    VALUES (v_org, p_horse_id, p_role, p_contact_id, p_term_start, p_term_end,
            current_contact_id());
  END IF;
END;
$function$;
