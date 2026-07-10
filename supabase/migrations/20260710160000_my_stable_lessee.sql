-- SPEC H.11 — account surfacing: a lease executed for me puts the horse in MY
-- stable. my_stable_horses v2 adds the current-lessee link (horses.lessee_contact_id,
-- set by the execution-effects trigger) alongside owner + active-party links, and
-- returns the lease term so the account can show it.
CREATE OR REPLACE FUNCTION public.my_stable_horses()
RETURNS TABLE (
  id              uuid,
  registered_name text,
  barn_name       text,
  breed           text,
  sex             text,
  height          text,
  date_of_birth   date,
  color           text,
  current_location text,
  is_owner        boolean,
  created_at      timestamptz,
  lease_start     date,
  lease_end       date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT h.id, h.registered_name, h.barn_name, h.breed, h.sex, h.height,
         h.date_of_birth, h.color, h.current_location,
         (h.current_owner_contact_id = current_contact_id()) AS is_owner,
         h.created_at, h.lease_start, h.lease_end
  FROM horses h
  WHERE h.deleted_at IS NULL
    AND h.org_id = current_org()
    AND (
      h.current_owner_contact_id = current_contact_id()
      OR h.lessee_contact_id     = current_contact_id()
      OR EXISTS (
        SELECT 1 FROM horse_parties hp
        WHERE hp.horse_id = h.id
          AND hp.deleted_at IS NULL
          AND hp.contact_id = current_contact_id()
          AND (hp.effective_to IS NULL OR hp.effective_to >= current_date)
      )
    )
  ORDER BY h.created_at
$$;
