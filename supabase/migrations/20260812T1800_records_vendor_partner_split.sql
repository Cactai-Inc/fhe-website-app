-- TASK RECORDS (2026-08-12) — split DIRECTORY into VENDOR and PARTNER.
--
-- Owner ruling: "Vendors and partners are separate." Vendor = you pay them
-- (farrier, vet, feed supplier, hauler). Partner = you work alongside them
-- (referring trainers, affiliated barns, event organisers, referral/
-- co-marketing relationships).
--
-- DIRECTORY has ZERO rows in production, so this is a pure schema widening —
-- no row is retyped. DIRECTORY stays ACCEPTED by the constraint and by
-- set_contact_type as a deprecated value (not removed): a hard removal is
-- the kind of thing that surprises a seeder, and the value still needs to
-- validate for any historical or seed data that names it.

ALTER TABLE contacts DROP CONSTRAINT contacts_contact_type_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_contact_type_check
  CHECK (contact_type IS NULL OR contact_type = ANY (ARRAY[
    'LEAD', 'CONTACT', 'TEAM', 'DIRECTORY', 'VENDOR', 'PARTNER'
  ]));

CREATE OR REPLACE FUNCTION public.set_contact_type(p_contact_id uuid, p_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  IF p_type IS NOT NULL AND p_type NOT IN ('LEAD','CONTACT','TEAM','DIRECTORY','VENDOR','PARTNER') THEN
    RAISE EXCEPTION 'contact_type must be LEAD, CONTACT, TEAM, DIRECTORY, VENDOR or PARTNER (got %)', p_type;
  END IF;

  UPDATE contacts
     SET contact_type = p_type, updated_at = now()
   WHERE id = p_contact_id
     AND org_id = current_org()
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'contact not found in this organisation: %', p_contact_id;
  END IF;
END
$function$;
