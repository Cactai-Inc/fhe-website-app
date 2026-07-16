-- The Lessee/Lessor (and Buyer/Seller) party pickers should offer the COMPANY
-- ("French Heritage Equestrian", the is_company contact) plus real client
-- contacts — NOT the personal contacts behind staff logins, and not junk
-- placeholders. When FHE is a party you select the company; both admin logins
-- then manage that contract equally (staff see-all + the company party is shared).
--
-- Dedicated to the party picker so the general staff_contact_options() (used by
-- the horse-owner picker etc.) is unchanged.
--
-- Ordering: company first (so it's the obvious FHE option), then clients by name.

CREATE OR REPLACE FUNCTION public.contract_party_options()
 RETURNS TABLE(id uuid, name text, email text, is_company boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id,
         CASE WHEN c.is_company
              THEN coalesce(nullif(trim(c.first_name), ''), 'French Heritage Equestrian')
              ELSE trim(concat_ws(' ', c.first_name, c.last_name)) END,
         c.email,
         c.is_company
  FROM contacts c
  WHERE c.org_id = current_org()
    AND c.deleted_at IS NULL
    AND has_staff_access()
    -- the company contact is always offered
    AND (
      c.is_company
      -- otherwise: a real client contact, i.e. NOT a personal contact behind a
      -- staff/admin login, and has a usable name or email (excludes placeholders)
      OR (
        NOT EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.contact_id = c.id
            AND (p.role IN ('ADMIN','MANAGER','EMPLOYEE','SUPER_ADMIN') OR p.is_admin)
        )
        AND (
          nullif(trim(concat_ws(' ', c.first_name, c.last_name)), '') IS NOT NULL
          AND trim(concat_ws(' ', c.first_name, c.last_name)) <> 'Unnamed Contact'
        )
      )
    )
  ORDER BY c.is_company DESC, c.last_name NULLS LAST, c.first_name
$function$;

GRANT EXECUTE ON FUNCTION public.contract_party_options() TO authenticated;
