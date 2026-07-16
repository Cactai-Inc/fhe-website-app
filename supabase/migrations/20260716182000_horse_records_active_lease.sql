-- Wire horse_active_lease_doc into staff_horse_records so the horse-record UI
-- can link straight to a horse's executed lease (audit LOW: reader had zero callers).
DROP FUNCTION IF EXISTS public.staff_horse_records();
CREATE OR REPLACE FUNCTION public.staff_horse_records()
 RETURNS TABLE(id uuid, registered_name text, barn_name text, breed text, color text, markings text, sex text, date_of_birth date, height text, registration_number text, registration_org text, microchip_id text, current_location text, fair_market_value numeric, vet_name text, vet_phone text, farrier_name text, farrier_phone text, owner_contact_id uuid, owner_name text, owner_name_text text, lessee_contact_id uuid, lessee_name text, lessee_name_text text, lease_start date, lease_end date, document_count bigint, active_lease_doc jsonb, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT h.id, h.registered_name, h.barn_name, h.breed, h.color,
         h.markings, h.sex, h.date_of_birth, h.height,
         h.registration_number, h.registration_org, h.microchip_id,
         h.current_location, h.fair_market_value,
         h.vet_name, h.vet_phone, h.farrier_name, h.farrier_phone,
         h.current_owner_contact_id,
         (SELECT trim(concat_ws(' ', c.first_name, c.last_name)) FROM contacts c WHERE c.id = h.current_owner_contact_id),
         h.owner_name_text,
         h.lessee_contact_id,
         (SELECT trim(concat_ws(' ', c.first_name, c.last_name)) FROM contacts c WHERE c.id = h.lessee_contact_id),
         h.lessee_name_text,
         h.lease_start, h.lease_end,
         (SELECT count(*) FROM horse_relationships r
           WHERE r.horse_id = h.id AND r.source_document_id IS NOT NULL),
         horse_active_lease_doc(h.id) AS active_lease_doc,
         h.created_at
  FROM horses h
  WHERE h.org_id = current_org() AND h.deleted_at IS NULL AND has_staff_access()
  ORDER BY coalesce(h.barn_name, h.registered_name)
$function$;
