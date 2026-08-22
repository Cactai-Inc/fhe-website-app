-- TASK-ARCHIVE §2 — AN ARCHIVED ACCOUNT LEAVES THE MAIN VIEWS, AND STAYS OUT
-- WITHOUT EVERY SCREEN HAVING TO REMEMBER.
--
-- The trap this migration exists to close: "`deleted_at IS NULL` must become
-- the DEFAULT everywhere, not an opt-in filter a screen forgets to add. A
-- listing that quietly omits the filter reintroduces exactly this bug."
--
-- Two halves, because the codebase reads contacts two ways:
--
--   (a) DIRECT TABLE READS from the browser — `supabase.from('contacts')` and
--       embedded joins like `contact:contacts(first_name, last_name)`. Sixteen
--       such reads exist across nine files. Most already filter; the point is
--       that the SEVENTEENTH does not have to. A RESTRICTIVE policy makes it
--       structurally impossible: restrictive policies are ANDed with whatever
--       permissive policy admitted the row, so it cannot be routed around by
--       matching contacts_admin_write or contacts_org_boundary instead. This is
--       the same shape the `*_org_boundary` policies already use throughout.
--
--   (b) SECURITY DEFINER RPCs, which bypass RLS entirely (contacts is owned by
--       postgres and is not FORCE ROW LEVEL SECURITY). Those must each say it,
--       and the three people-listings that did not are fixed below.
--
-- ⚠️ WHAT DELIBERATELY DOES NOT GET THE FILTER. Every read that RESOLVES a
-- party, a signer, an owner or an author by id — contract_document_detail,
-- document_parties_summary, contact_dossier, fill_party_fields_from_contacts,
-- party_user_ids, list_deals, staff_horse_records and the rest — keeps reading
-- archived rows, because that is the entire feature (D11/D15/D32): the account
-- leaves the roster, the evidence it is attached to does not change for anyone
-- else. Those are all SECURITY DEFINER, so (a) does not reach them either.

-- ── (a) THE DEFAULT ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS contacts_hide_archived ON public.contacts;
CREATE POLICY contacts_hide_archived ON public.contacts
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (deleted_at IS NULL);
COMMENT ON POLICY contacts_hide_archived ON public.contacts IS
  'D11/D32: an archived contact is invisible to every direct table read, so a listing that forgets the filter cannot reintroduce the bug. RESTRICTIVE, so it ANDs with contacts_select / contacts_admin_write rather than being ORed around. SECURITY DEFINER RPCs are unaffected by design — that is where the archived row is still legitimately readable (a document''s parties, the deleted-accounts view).';

-- ── (b) THE THREE DEFINER LISTINGS THAT DID NOT SAY IT ──────────────────────

-- credits_roster: staff roster of who is holding credits. The join was to
-- contacts purely for the name, but the row is a PERSON in a staff list, so an
-- archived person must not be in it.
CREATE OR REPLACE FUNCTION public.credits_roster()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid := current_org();
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'client_id', cl.id,
        'name', trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')),
        'credits_remaining', r.rem) ORDER BY r.rem DESC), '[]'::jsonb)
    FROM (
      SELECT client_id, sum(credits_remaining)::int AS rem
      FROM lesson_credits
      WHERE org_id = v_org AND deleted_at IS NULL
        AND (expires_at IS NULL OR expires_at > now())
      GROUP BY client_id
      HAVING sum(credits_remaining) > 0
    ) r
    JOIN clients cl ON cl.id = r.client_id
    JOIN contacts c ON c.id = cl.contact_id AND c.deleted_at IS NULL);
END;
$function$;

-- lesson_plan_roster: the riders Claire works through. LEFT JOIN kept (a client
-- with no contact row still has a plan), so the filter is written to exclude
-- only rows whose contact EXISTS and is archived.
CREATE OR REPLACE FUNCTION public.lesson_plan_roster()
 RETURNS TABLE(client_id uuid, client_name text, plan_id uuid, plan_version integer, focus text, next_up text, objective_count integer, achieved_count integer, plan_updated_at timestamp with time zone, last_lesson_at timestamp with time zone, next_lesson_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT cl.id,
         nullif(btrim(coalesce(ct.first_name, '') || ' ' || coalesce(ct.last_name, '')), ''),
         pl.id, pl.version, pl.focus,
         lesson_plan_next_up(pl.objectives) ->> 'label',
         coalesce(jsonb_array_length(pl.objectives), 0),
         coalesce((SELECT count(*)::int FROM jsonb_array_elements(coalesce(pl.objectives, '[]'::jsonb)) e
                    WHERE e ->> 'state' = 'achieved'), 0),
         pl.created_at,
         (SELECT max(b.starts_at) FROM bookings b
           WHERE b.client_id = cl.id AND b.kind = 'lesson' AND b.deleted_at IS NULL
             AND b.starts_at <= now()),
         (SELECT min(b.starts_at) FROM bookings b
           WHERE b.client_id = cl.id AND b.kind = 'lesson' AND b.deleted_at IS NULL
             AND b.starts_at > now() AND b.status NOT IN ('cancelled', 'expired'))
    FROM clients cl
    LEFT JOIN contacts ct ON ct.id = cl.contact_id
    LEFT JOIN lesson_plans pl ON pl.client_id = cl.id AND pl.status = 'current'
   WHERE coalesce(has_staff_access() AND cl.org_id = current_org(), false)
     AND cl.deleted_at IS NULL
     AND (ct.id IS NULL OR ct.deleted_at IS NULL)
     AND (pl.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM bookings b
                      WHERE b.client_id = cl.id AND b.kind = 'lesson'
                        AND b.deleted_at IS NULL))
   ORDER BY (SELECT min(b.starts_at) FROM bookings b
              WHERE b.client_id = cl.id AND b.kind = 'lesson' AND b.deleted_at IS NULL
                AND b.starts_at > now() AND b.status NOT IN ('cancelled', 'expired'))
            ASC NULLS LAST,
            cl.created_at DESC
$function$;

-- instructor_options: the "who is teaching this" picker. Driven by profiles,
-- so an archived contact still appeared as long as the staff profile was
-- active — a picker offering an archived person is exactly §2's complaint.
CREATE OR REPLACE FUNCTION public.instructor_options()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid := current_org();
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'user_id', x.user_id,
        'name',    x.name,
        'title',   x.title) ORDER BY x.name), '[]'::jsonb)
      FROM (
        SELECT p.user_id,
               coalesce(
                 nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''),
                 nullif(btrim(coalesce(p.display_name,'')), ''),
                 c.email,
                 'Staff') AS name,
               p.title
          FROM profiles p
          LEFT JOIN contacts c ON c.id = p.contact_id
         WHERE p.org_id = v_org
           AND coalesce(p.staff_active, false)
           AND p.role IN ('ADMIN','MANAGER','EMPLOYEE')
           AND (c.id IS NULL OR c.deleted_at IS NULL)
      ) x);
END;
$function$;
