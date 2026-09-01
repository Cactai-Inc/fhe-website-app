-- ─────────────────────────────────────────────────────────────────────────────
-- PERSON CONSOLIDATION — S4: the four pages get real definitions (2026-07-30)
--
-- Today all the person-pages render the SAME component over the SAME RPC and are
-- split CLIENT-SIDE by a derived designation. The derivation is the problem:
--
--   ContactsPage.tsx:51 → if (d.length === 0) d.push('Lead')
--
-- A contact was a "Lead" only because nothing else classified it. That is why
-- the Leads page never formed a usable campaign list — it was the leftover pile,
-- and it silently swallowed vendors, family members and anyone mid-setup.
--
-- S1b established contacts.contact_type as the explicit discriminator, in the
-- owner's four-way model:
--
--   LEAD      potential future client — outreach / campaign target
--   CONTACT   an internal person the business SERVES (client, member, horse
--             owner, counterparty) who is not part of the company
--   TEAM      the company itself: staff and internal accounts
--   DIRECTORY external people and BUSINESSES that PROVIDE something — farriers,
--             vets, suppliers, service providers, event organizers
--
-- The distinction that makes the split work: someone we SERVE who has not bought
-- yet is a LEAD; someone who SELLS to us is DIRECTORY.
--
-- This migration returns contact_type from the directory RPC so each page can
-- filter on a real stored value instead of inferring one. Additive: the column
-- is appended, so existing callers that select by name keep working.
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.staff_contact_directory();

CREATE OR REPLACE FUNCTION public.staff_contact_directory()
 RETURNS TABLE(
   id uuid, display_code text, first_name text, last_name text, email text,
   phone text, tags text[], notes text, created_at timestamptz,
   linked_user_id uuid, linked_role text, is_client boolean, party_roles text[],
   horses_owned bigint, horses_leased bigint, engagement_count bigint,
   document_count bigint,
   contact_type text, is_company boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id, c.display_code, c.first_name, c.last_name,
         c.email, c.phone, c.tags, c.notes, c.created_at,
         p.user_id, p.role,
         EXISTS (SELECT 1 FROM clients cl
                  WHERE cl.contact_id = c.id AND cl.deleted_at IS NULL),
         (SELECT coalesce(array_agg(DISTINCT dp.party_role), '{}')
            FROM document_parties dp WHERE dp.contact_id = c.id),
         (SELECT count(*) FROM horses h
           WHERE h.current_owner_contact_id = c.id AND h.deleted_at IS NULL),
         (SELECT count(*) FROM horses h
           WHERE h.lessee_contact_id = c.id AND h.deleted_at IS NULL),
         0::bigint,
         (SELECT count(DISTINCT d.id)
            FROM documents d
           WHERE d.deleted_at IS NULL
             AND (d.contact_id = c.id
                  OR EXISTS (SELECT 1 FROM document_parties dp
                              WHERE dp.document_id = d.id AND dp.contact_id = c.id))),
         c.contact_type,
         coalesce(c.is_company, false)
  FROM contacts c
  LEFT JOIN profiles p ON p.contact_id = c.id
  WHERE c.org_id = current_org()
    AND c.deleted_at IS NULL
    AND has_staff_access()
  ORDER BY c.last_name NULLS LAST, c.first_name
$function$;

COMMENT ON FUNCTION public.staff_contact_directory() IS
  'Every contact in the org, for the staff person-pages. `contact_type` is the '
  'page discriminator (LEAD | CONTACT | TEAM | DIRECTORY) — an EXPLICIT stored '
  'value, not a derived leftover. A NULL contact_type means unclassified and is '
  'surfaced deliberately so a human can file it, rather than being defaulted into '
  'a bucket and forgotten.';

-- ── Setting the type ─────────────────────────────────────────────────────────
-- Staff-only, and validated against the same CHECK the column carries, so the UI
-- cannot introduce a fifth bucket by typo.
CREATE OR REPLACE FUNCTION public.set_contact_type(p_contact_id uuid, p_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  IF p_type IS NOT NULL AND p_type NOT IN ('LEAD','CONTACT','TEAM','DIRECTORY') THEN
    RAISE EXCEPTION 'contact_type must be LEAD, CONTACT, TEAM or DIRECTORY (got %)', p_type;
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

COMMENT ON FUNCTION public.set_contact_type(uuid, text) IS
  'Move a contact between the person-pages. Staff only; validates against the '
  'same four values the column CHECK enforces, so a typo cannot invent a bucket.';

GRANT EXECUTE ON FUNCTION public.set_contact_type(uuid, text) TO authenticated;
