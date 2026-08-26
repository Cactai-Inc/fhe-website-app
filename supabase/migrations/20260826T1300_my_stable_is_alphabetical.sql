-- MY STABLE IS ALPHABETICAL.
--
-- Owner's principle, ruled on the client list (CR-75): a list you BROWSE is
-- ordered by name, because findability beats every other ordering — "it loses
-- anyway because it is not alphabetised". `my_stable_horses` returned horses in
-- the order they were ADDED, which is an ordering only the person who added them
-- can predict.
--
-- Barn name first, falling back to the registered name — the same precedence the
-- horse label uses everywhere else, so the list reads in the order it displays.
-- `created_at` stays as the tiebreak so the order is stable for two horses whose
-- names sort equal.

BEGIN;
CREATE OR REPLACE FUNCTION public.my_stable_horses(p_as_company boolean DEFAULT NULL::boolean)
 RETURNS TABLE(id uuid, registered_name text, nickname text, breed text, sex text, height text, date_of_birth date, color text, current_location text, is_owner boolean, created_at timestamp with time zone, lease_start date, lease_end date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_scope uuid;
  v_as_company boolean := coalesce(p_as_company, has_staff_access());
BEGIN
  IF v_as_company AND NOT has_staff_access() THEN
    RAISE EXCEPTION 'only staff may view the company''s stable';
  END IF;
  v_scope := CASE WHEN v_as_company THEN company_contact_id()
                  ELSE current_contact_id() END;
  RETURN QUERY
  SELECT h.id, h.registered_name, h.nickname, h.breed, h.sex, h.height,
         h.date_of_birth, h.color, h.current_location,
         (h.current_owner_contact_id = v_scope) AS is_owner,
         h.created_at, h.lease_start, h.lease_end
  FROM horses h
  WHERE h.deleted_at IS NULL
    AND h.org_id = current_org()
    AND (
      h.current_owner_contact_id = v_scope
      OR h.lessee_contact_id     = v_scope
      OR EXISTS (
        SELECT 1 FROM horse_relationships hr
        WHERE hr.horse_id = h.id AND hr.active
          AND hr.party_contact_id = v_scope
          AND (hr.term_end IS NULL OR hr.term_end >= current_date)
      )
    )
  ORDER BY lower(coalesce(nullif(btrim(h.nickname),''), h.registered_name, '')), h.created_at;
END;
$function$;
COMMIT;
