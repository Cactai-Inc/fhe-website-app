-- TASK-COUNTFIX 1.2 — "Documents · N attached" on a horse counted the wrong thing.
--
-- `staff_horse_records().document_count` counted RELATIONSHIP ROWS CREATED BY A
-- DOCUMENT:
--
--     SELECT count(*) FROM horse_relationships r
--      WHERE r.horse_id = h.id AND r.source_document_id IS NOT NULL
--
-- The label next to it says "Documents", and the link beside it opens the
-- documents queue. Neither agreed with the other for ANY horse in production:
--
--     horse       old (relationship rows)   documents queue "By horse"
--     Beau                3                        5
--     Peep Show           0                        6
--     Secret              0                        3
--     Tiz                 0                        6
--
-- Three horses read "0 attached" beside a documents icon while holding 6, 3 and
-- 6 documents; Beau read 3 for 2 documents, because two relationship rows shared
-- one source document.
--
-- THE ONE DEFINITION (COUNTFIX 1.2): a horse's documents are
--     documents WHERE horse_id = h.id AND deleted_at IS NULL, in this org
-- which is exactly the row set `/app/ops/documents` → preset "By horse" lists
-- (`listDocuments()` selects `documents` with `deleted_at IS NULL`; the preset
-- filters `d.horse_id === horseId`, with the status filter on ALL).
--
-- Nothing is lost: the relationship-provenance count is not a count of
-- documents, and no surface asked for it. `document_count` keeps its name
-- because the label it feeds is correct — it was the quantity that was wrong.
--
-- Rewrite-in-place caveat (see CLAUDE.md): this file replaces the whole function
-- body rather than string-patching it, so it IS safe to replay on a fresh database.

CREATE OR REPLACE FUNCTION public.staff_horse_records()
 RETURNS TABLE(id uuid, registered_name text, nickname text, breed text, color text, markings text, sex text, date_of_birth date, height text, registration_number text, registration_org text, microchip_id text, current_location text, fair_market_value numeric, vet_name text, vet_phone text, farrier_name text, farrier_phone text, owner_contact_id uuid, owner_name text, owner_name_text text, lessee_contact_id uuid, lessee_name text, lessee_name_text text, lease_start date, lease_end date, document_count bigint, active_lease_doc jsonb, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT h.id, h.registered_name, h.nickname, h.breed, h.color,
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
         -- COUNTFIX 1.2: documents, not document-sourced relationship rows.
         -- Same predicate as the documents queue's "By horse" preset.
         (SELECT count(*) FROM documents d
           WHERE d.horse_id = h.id
             AND d.deleted_at IS NULL
             AND d.org_id = h.org_id),
         horse_active_lease_doc(h.id) AS active_lease_doc,
         h.created_at
  FROM horses h
  WHERE h.org_id = current_org() AND h.deleted_at IS NULL AND has_staff_access()
  ORDER BY coalesce(h.nickname, h.registered_name)
$function$;
