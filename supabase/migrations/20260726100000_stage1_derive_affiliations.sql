-- Ecosystem Stage 1 — derive_affiliations (the SINGLE source of truth for a
-- person's community groups), built read-only-first so we can prove it reproduces
-- correct state before it becomes authoritative.
--
-- Rules (verified against live data + category_document_requirements):
--   RIDER       ⇐ executed RELEASE_PARTICIPANT
--   HORSE_OWNER ⇐ (executed RELEASE_HORSE_CARE AND HORSE_EMERGENCY_VET)
--                 OR owns a horse (horses.current_owner_contact_id)
--   PARENT_GUARDIAN ⇐ is a GUARDIAN document party of a minor rider
--                     (kept as a group because a rider's guardian is a community member)
-- Guest is NOT a group (guest = account holder with no rider/owner group).
-- Buyer/Lessee/Lessor/Seller are per-document roles, NOT standing groups.
--
-- This migration adds ONLY the derivation function (pure, read-only). It does not
-- write anything or rename anything yet — Stage 2 makes it the sole writer.

BEGIN;

-- Returns the set of groups a contact SHOULD hold, derived from executed
-- documents + horse ownership + guardian party rows. Pure/read-only.
CREATE OR REPLACE FUNCTION public.derive_affiliations(p_contact_id uuid)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH ex AS (
    SELECT bool_or(t.template_key = 'RELEASE_PARTICIPANT') AS sig_rider,
           bool_or(t.template_key = 'RELEASE_HORSE_CARE')  AS sig_care,
           bool_or(t.template_key = 'HORSE_EMERGENCY_VET') AS sig_vet
      FROM documents d
      JOIN contract_templates t ON t.id = d.template_id
     WHERE d.contact_id = p_contact_id AND d.status = 'EXECUTED' AND d.deleted_at IS NULL
  )
  SELECT (
    SELECT array_agg(g ORDER BY g) FROM (
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
$function$;

-- Read-only reconciliation view: what each contact's groups SHOULD be vs the
-- current contact_roles state. This is the Stage-1 proof surface + the acceptance
-- check for Stage 2's cutover.
CREATE OR REPLACE FUNCTION public.affiliation_reconciliation()
RETURNS TABLE(contact_id uuid, display_code text, name text, has_account boolean,
              derived_groups text[], current_group_roles text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.id, c.display_code,
         nullif(btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')), ''),
         (p.user_id IS NOT NULL),
         coalesce(derive_affiliations(c.id), ARRAY[]::text[]),
         coalesce((SELECT array_agg(DISTINCT r.role_type ORDER BY r.role_type)
                     FROM contact_roles r
                    WHERE r.contact_id = c.id
                      AND r.role_type IN ('RIDER','HORSE_OWNER','PARENT_GUARDIAN','GUEST')),
                  ARRAY[]::text[])
    FROM contacts c
    LEFT JOIN profiles p ON p.contact_id = c.id
   WHERE c.deleted_at IS NULL
   ORDER BY nullif(btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')), '');
$function$;

COMMIT;
